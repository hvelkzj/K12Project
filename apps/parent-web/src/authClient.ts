import type {
  ApiError,
  CurrentUserResponse,
  LoginRequest,
  LoginResponse,
  UserSummary,
} from '@k12/shared'

export const accessTokenStorageKey = 'k12AccessToken'
export const defaultApiBaseUrl = 'http://127.0.0.1:3000'

export interface AuthClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

export interface ParentAuthClient {
  login(username: string, password: string): Promise<UserSummary>
  restoreCurrentUser(): Promise<UserSummary | null>
  logout(): Promise<void>
  getAccessToken(): string | null
}

function createMemoryStorage(): Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
> {
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

function getDefaultStorage(): Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
> {
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
    // Keep the fallback below when the API returns an empty or invalid body.
  }

  return '认证服务暂时不可用'
}

function assertParentRole(user: UserSummary): UserSummary {
  if (user.role !== 'PARENT') {
    throw new Error('当前账号不是家长角色')
  }

  return user
}

export function createParentAuthClient(
  options: AuthClientOptions = {},
): ParentAuthClient {
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

  async function requestJson<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await fetchImpl(`${apiBaseUrl}${path}`, init)

    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }

    return (await response.json()) as T
  }

  return {
    async login(username, password) {
      const body: LoginRequest = { username, password }
      const login = await requestJson<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const user = assertParentRole(login.user)
      storage.setItem(accessTokenStorageKey, login.accessToken)
      return user
    },

    async restoreCurrentUser() {
      const accessToken = getAccessToken()
      if (!accessToken) return null

      const response = await fetchImpl(`${apiBaseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
        return assertParentRole(currentUser.user)
      } catch (error) {
        clearAccessToken()
        throw error
      }
    },

    async logout() {
      const accessToken = getAccessToken()

      if (accessToken) {
        const response = await fetchImpl(`${apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok && response.status !== 401) {
          throw new Error(await readErrorMessage(response))
        }
      }

      clearAccessToken()
    },

    getAccessToken,
  }
}

export const parentAuthClient = createParentAuthClient()
