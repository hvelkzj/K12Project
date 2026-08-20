import type {
  ApiError,
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  UserSummary,
} from '@k12/shared'

export const accessTokenStorageKey = 'k12AccessToken'
export const defaultApiBaseUrl = 'http://127.0.0.1:3000'

type AuthStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface StudentAuthClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  storage?: AuthStorage
}

export interface StudentAuthClient {
  login(username: string, password: string): Promise<UserSummary>
  restoreCurrentUser(): Promise<UserSummary | null>
  logout(): Promise<void>
  getAccessToken(): string | null
  clearAccessToken(): void
}

function createMemoryStorage(): AuthStorage {
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

function getDefaultStorage(): AuthStorage {
  return typeof sessionStorage === 'undefined'
    ? createMemoryStorage()
    : sessionStorage
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '')
}

function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown
    if (isApiError(body)) return body.message
  } catch {
    // Use the stable fallback below for empty or invalid response bodies.
  }

  return '认证服务暂时不可用'
}

function assertStudentRole(user: UserSummary): UserSummary {
  if (user.role !== 'STUDENT') {
    throw new Error('权限不足：非学生角色不能进入此端')
  }

  return user
}

export function createStudentAuthClient(
  options: StudentAuthClientOptions = {},
): StudentAuthClient {
  const viteEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>
    }
  ).env
  const apiBaseUrl = normalizeApiBaseUrl(
    options.apiBaseUrl ??
      viteEnv?.VITE_API_BASE_URL ??
      defaultApiBaseUrl,
  )
  const fetchImpl = options.fetchImpl ?? fetch
  const storage = options.storage ?? getDefaultStorage()

  function getAccessToken(): string | null {
    return storage.getItem(accessTokenStorageKey)
  }

  function clearAccessToken(): void {
    storage.removeItem(accessTokenStorageKey)
  }

  async function revokeSession(accessToken: string): Promise<void> {
    try {
      await fetchImpl(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch {
      // A role mismatch must never grant access, even if cleanup is unavailable.
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

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const login = (await response.json()) as LoginResponse

      try {
        const user = assertStudentRole(login.user)
        storage.setItem(accessTokenStorageKey, login.accessToken)
        return user
      } catch (error) {
        await revokeSession(login.accessToken)
        clearAccessToken()
        throw error
      }
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

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const currentUser = (await response.json()) as CurrentUserResponse

      try {
        return assertStudentRole(currentUser.user)
      } catch (error) {
        clearAccessToken()
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
          throw new Error(await readErrorMessage(response))
        }
      } finally {
        clearAccessToken()
      }
    },

    getAccessToken,

    clearAccessToken,
  }
}

export const authService = createStudentAuthClient()
