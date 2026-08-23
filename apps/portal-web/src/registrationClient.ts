import type {
  ApiError,
  RegisterRequest,
  RegisterResponse,
  UserAccountSummary,
} from '@k12/shared'

export const defaultApiBaseUrl = 'http://127.0.0.1:3000'

export interface RegistrationClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
}

export interface RegistrationClient {
  register(input: RegisterRequest): Promise<UserAccountSummary>
}

function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown
    if (isApiError(body)) return body.message
  } catch {
    // Use the stable fallback when an upstream response is empty or invalid.
  }
  return '注册服务暂时不可用，请稍后重试。'
}

export function createRegistrationClient(
  options: RegistrationClientOptions = {},
): RegistrationClient {
  const viteEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>
    }
  ).env
  const apiBaseUrl = (
    options.apiBaseUrl ??
    viteEnv?.VITE_API_BASE_URL ??
    defaultApiBaseUrl
  ).replace(/\/+$/, '')
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    async register(input) {
      const response = await fetchImpl(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) throw new Error(await errorMessage(response))
      return ((await response.json()) as RegisterResponse).user
    },
  }
}

export const registrationClient = createRegistrationClient()
