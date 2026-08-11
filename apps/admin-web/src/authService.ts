import type {
  CurrentUserResponse,
  LoginResponse,
  UserSummary,
} from '@k12/shared'

export const ACCESS_TOKEN_KEY = 'k12AccessToken'

export const ADMIN_ROLES = ['ACADEMIC_ADMIN', 'SYSTEM_ADMIN'] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export interface AuthSession {
  user: UserSummary
  accessToken: string
  expiresAt: string
}

export interface AuthClient {
  login(username: string, password: string): Promise<AuthSession>
  getCurrentUser(): Promise<UserSummary | null>
  logout(): Promise<void>
}

export interface AuthClientOptions {
  apiBaseUrl: string
  fetchImpl?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

export function isAdminRole(role: string | undefined): role is AdminRole {
  return role === 'ACADEMIC_ADMIN' || role === 'SYSTEM_ADMIN'
}

export function createAuthClient(options: AuthClientOptions): AuthClient {
  const apiBaseUrl = options.apiBaseUrl
  const fetchImpl = options.fetchImpl ?? fetch
  const storage = options.storage ?? sessionStorage

  async function readError(response: Response): Promise<Error> {
    try {
      const body = (await response.json()) as { message?: string }
      return new Error(body.message ?? '请求失败，请稍后重试')
    } catch {
      return new Error('请求失败，请稍后重试')
    }
  }

  return {
    async login(username, password) {
      const response = await fetchImpl(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw await readError(response)
      }

      const session = (await response.json()) as LoginResponse
      storage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
      return {
        user: session.user,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
      }
    },

    async getCurrentUser() {
      const accessToken = storage.getItem(ACCESS_TOKEN_KEY)
      if (!accessToken) return null

      const response = await fetchImpl(`${apiBaseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (response.status === 401) {
        storage.removeItem(ACCESS_TOKEN_KEY)
        return null
      }

      if (!response.ok) {
        throw await readError(response)
      }

      const body = (await response.json()) as CurrentUserResponse
      return body.user
    },

    async logout() {
      const accessToken = storage.getItem(ACCESS_TOKEN_KEY)
      if (!accessToken) return

      try {
        await fetchImpl(`${apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      } finally {
        storage.removeItem(ACCESS_TOKEN_KEY)
      }
    },
  }
}
