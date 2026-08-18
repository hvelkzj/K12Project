import type {
  ApiError,
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  UserSummary,
} from '@k12/shared'

import { isTeacherUser, type TeacherUser } from './teacherAccess'

export const ACCESS_TOKEN_STORAGE_KEY = 'k12AccessToken'
export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000'

type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface TeacherAuthClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  storage?: TokenStorage
}

export interface TeacherAuthClient {
  login(username: string, password: string): Promise<TeacherUser>
  restoreCurrentUser(): Promise<TeacherUser | null>
  logout(): Promise<void>
  getAccessToken(): string | null
  clearAccessToken(): void
}

function createMemoryStorage(): TokenStorage {
  const values = new Map<string, string>()

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

function defaultStorage(): TokenStorage {
  return typeof sessionStorage === 'undefined'
    ? createMemoryStorage()
    : sessionStorage
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}

async function readError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as unknown
    if (isApiError(body)) return new Error(body.message)
  } catch {
    // Use the stable fallback for an empty or invalid error body.
  }

  return new Error('认证服务暂时不可用')
}

function teacherUser(user: UserSummary): TeacherUser {
  if (!isTeacherUser(user)) {
    throw new Error('当前账号不是教师或班主任角色')
  }
  return user
}

export function createTeacherAuthClient(
  options: TeacherAuthClientOptions = {},
): TeacherAuthClient {
  const viteEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>
    }
  ).env
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl ??
      viteEnv?.VITE_API_BASE_URL ??
      DEFAULT_API_BASE_URL,
  )
  const fetchImpl = options.fetchImpl ?? fetch
  const storage = options.storage ?? defaultStorage()

  function getAccessToken(): string | null {
    return storage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  }

  function clearAccessToken(): void {
    storage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  }

  async function revokeSession(accessToken: string): Promise<void> {
    try {
      await fetchImpl(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch {
      // The client must still reject the role and remove its local token.
    }
  }

  return {
    async login(username, password) {
      const body: LoginRequest = { username, password }
      const response = await fetchImpl(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw await readError(response)

      const session = (await response.json()) as LoginResponse
      if (!isTeacherUser(session.user)) {
        clearAccessToken()
        await revokeSession(session.accessToken)
        throw new Error('当前账号不是教师或班主任角色')
      }

      storage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken)
      return session.user
    },

    async restoreCurrentUser() {
      const accessToken = getAccessToken()
      if (!accessToken) return null

      const response = await fetchImpl(`${apiBaseUrl}/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.status === 401) {
        clearAccessToken()
        return null
      }
      if (!response.ok) throw await readError(response)

      const current = (await response.json()) as CurrentUserResponse
      try {
        return teacherUser(current.user)
      } catch (error) {
        clearAccessToken()
        await revokeSession(accessToken)
        throw error
      }
    },

    async logout() {
      const accessToken = getAccessToken()

      try {
        if (!accessToken) return
        const response = await fetchImpl(`${apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok && response.status !== 401) {
          throw await readError(response)
        }
      } finally {
        clearAccessToken()
      }
    },

    getAccessToken,
    clearAccessToken,
  }
}

export const teacherAuthClient = createTeacherAuthClient()
