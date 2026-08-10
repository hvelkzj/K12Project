import { createHash, randomBytes } from 'node:crypto'

import type { LoginResponse, UserSummary } from '@k12/shared'
import { MOCK_ACCOUNTS } from '@k12/shared/mock-accounts'

const defaultSessionDurationMs = 8 * 60 * 60 * 1000
const maximumSessionsPerUser = 5

interface SessionRecord {
  userId: number
  expiresAtMs: number
}

export interface AuthService {
  login(username: string, password: string): LoginResponse | null
  getCurrentUser(accessToken: string): UserSummary | null
  logout(accessToken: string): boolean
  reset(): void
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

export function createAuthService(
  options: AuthServiceOptions = {},
): AuthService {
  const now = options.now ?? Date.now
  const createToken =
    options.createToken ?? (() => randomBytes(32).toString('base64url'))
  const sessionDurationMs =
    options.sessionDurationMs ?? defaultSessionDurationMs
  const sessions = new Map<string, SessionRecord>()

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

  return {
    login(username, password) {
      const currentTime = now()
      removeExpiredSessions(currentTime)

      const account = MOCK_ACCOUNTS.find(
        (candidate) => candidate.username === username,
      )

      if (!account || !account.active || account.password !== password) {
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

      const account = MOCK_ACCOUNTS.find(
        (candidate) => candidate.user.id === session.userId,
      )
      return account ? cloneUser(account.user) : null
    },

    logout(accessToken) {
      const tokenHash = hashToken(accessToken)
      const session = sessions.get(tokenHash)

      if (!session) return false

      sessions.delete(tokenHash)
      return session.expiresAtMs > now()
    },

    reset() {
      sessions.clear()
    },
  }
}
