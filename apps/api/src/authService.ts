import { createHash, randomBytes } from 'node:crypto'

import type {
  LoginResponse,
  RegisterRequest,
  UserAccountSummary,
  UserSummary,
} from '@k12/shared'
import { MOCK_ACCOUNTS } from '@k12/shared/mock-accounts'

const defaultSessionDurationMs = 8 * 60 * 60 * 1000
const maximumSessionsPerUser = 5

interface SessionRecord {
  userId: number
  expiresAtMs: number
}

export interface AuthService {
  register(input: RegisterRequest): UserAccountSummary | null
  login(username: string, password: string): LoginResponse | null
  getCurrentUser(accessToken: string): UserSummary | null
  logout(accessToken: string): boolean
  setAccountActive(userId: number, active: boolean): void
  reset(): void
}

interface AuthAccount {
  username: string
  password: string
  active: boolean
  user: UserSummary
}

export interface AuthServiceOptions {
  now?: () => number
  createToken?: () => string
  sessionDurationMs?: number
}

function hashToken(accessToken: string): string {
  return createHash('sha256').update(accessToken).digest('hex')
}

function cloneUser(user: UserSummary): UserSummary {
  return { ...user }
}

function initialAccounts(): Map<string, AuthAccount> {
  return new Map(
    MOCK_ACCOUNTS.map((account) => [
      account.username,
      {
        username: account.username,
        password: account.password,
        active: account.active,
        user: cloneUser(account.user),
      },
    ]),
  )
}

export function createAuthService(
  options: AuthServiceOptions = {},
): AuthService {
  const now = options.now ?? Date.now
  const createToken =
    options.createToken ?? (() => randomBytes(32).toString('base64url'))
  const sessionDurationMs =
    options.sessionDurationMs ?? defaultSessionDurationMs
  const sessions = new Map<string, SessionRecord>()
  const accountActiveOverrides = new Map<number, boolean>()
  let accounts = initialAccounts()

  if (!Number.isFinite(sessionDurationMs) || sessionDurationMs <= 0) {
    throw new TypeError('sessionDurationMs must be a positive number')
  }

  function removeExpiredSessions(currentTime: number): void {
    for (const [tokenHash, session] of sessions) {
      if (session.expiresAtMs <= currentTime) {
        sessions.delete(tokenHash)
      }
    }
  }

  function makeRoomForUser(userId: number): void {
    const tokenHashes: string[] = []

    for (const [tokenHash, session] of sessions) {
      if (session.userId === userId) tokenHashes.push(tokenHash)
    }

    const numberToRemove =
      tokenHashes.length - maximumSessionsPerUser + 1
    for (let index = 0; index < numberToRemove; index += 1) {
      const tokenHash = tokenHashes[index]
      if (tokenHash !== undefined) sessions.delete(tokenHash)
    }
  }

  function isAccountActive(userId: number, initialActive: boolean): boolean {
    return accountActiveOverrides.get(userId) ?? initialActive
  }

  function revokeUserSessions(userId: number): void {
    for (const [tokenHash, session] of sessions) {
      if (session.userId === userId) sessions.delete(tokenHash)
    }
  }

  return {
    register(input) {
      if (accounts.has(input.username)) return null

      const userId =
        Math.max(1000, ...[...accounts.values()].map(({ user }) => user.id)) + 1
      const user: UserSummary = {
        id: userId,
        displayName: input.displayName,
        role: input.role,
        campusId: 1,
        campusName: '滨江校区',
      }
      accounts.set(input.username, {
        username: input.username,
        password: input.password,
        active: true,
        user,
      })

      return {
        ...cloneUser(user),
        username: input.username,
        active: true,
      }
    },

    login(username, password) {
      const currentTime = now()
      removeExpiredSessions(currentTime)

      const account = accounts.get(username)

      if (
        !account ||
        !isAccountActive(account.user.id, account.active) ||
        account.password !== password
      ) {
        return null
      }

      const accessToken = createToken()
      if (accessToken.length === 0) {
        throw new Error('createToken must return a non-empty token')
      }

      const expiresAtMs = currentTime + sessionDurationMs
      makeRoomForUser(account.user.id)
      sessions.set(hashToken(accessToken), {
        userId: account.user.id,
        expiresAtMs,
      })

      return {
        accessToken,
        tokenType: 'Bearer',
        expiresAt: new Date(expiresAtMs).toISOString(),
        user: cloneUser(account.user),
      }
    },

    getCurrentUser(accessToken) {
      const tokenHash = hashToken(accessToken)
      const session = sessions.get(tokenHash)

      if (!session) return null

      if (session.expiresAtMs <= now()) {
        sessions.delete(tokenHash)
        return null
      }

      const account = [...accounts.values()].find(
        (candidate) => candidate.user.id === session.userId,
      )
      if (!account || !isAccountActive(account.user.id, account.active)) {
        sessions.delete(tokenHash)
        return null
      }
      return cloneUser(account.user)
    },

    logout(accessToken) {
      const tokenHash = hashToken(accessToken)
      const session = sessions.get(tokenHash)

      if (!session) return false

      sessions.delete(tokenHash)
      return session.expiresAtMs > now()
    },

    setAccountActive(userId, active) {
      accountActiveOverrides.set(userId, active)
      if (!active) revokeUserSessions(userId)
    },

    reset() {
      sessions.clear()
      accountActiveOverrides.clear()
      accounts = initialAccounts()
    },
  }
}
