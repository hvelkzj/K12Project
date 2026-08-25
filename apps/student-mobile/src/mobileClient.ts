import type {
  ApiError,
  CurrentUserResponse,
  FileSummary,
  LoginResponse,
  StudentOverview,
  Submission,
  UserSummary,
} from '@k12/shared'

export const mobileTokenStorageKey = 'k12MobileAccessToken'
export const mobileServiceUrlStorageKey = 'k12MobileServiceUrl'
export const mobileRequestTimeoutMs = 10_000

export interface MobileStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export interface MobileRequest {
  path: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  data?: string | Record<string, unknown> | ArrayBuffer
}

export interface MobileResponse<T> {
  status: number
  data: T
}

export interface MobileTransport {
  request<T>(input: MobileRequest): Promise<MobileResponse<T>>
  download(path: string, headers: Record<string, string>): Promise<{
    status: number
    tempFilePath: string
  }>
}

export interface MobileFileInput {
  name: string
  mimeType: string
  byteSize: number
  base64: string
}

export interface MobileStudentClient {
  getServiceUrl(): string
  setServiceUrl(value: string): string
  checkConnection(): Promise<void>
  login(username: string, password: string): Promise<UserSummary>
  restoreCurrentUser(): Promise<UserSummary | null>
  logout(): Promise<void>
  getOverview(): Promise<StudentOverview>
  uploadFile(input: MobileFileInput): Promise<FileSummary>
  downloadFile(fileId: number): Promise<string>
  submitWork(input: {
    assignmentId: number
    content: string
    attachments: FileSummary[]
  }): Promise<Submission>
  getAccessToken(): string | null
  clearAccessToken(): void
}

export class MobileClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'MobileClientError'
  }
}

export function defaultServiceUrl(): string {
  let value = 'http://127.0.0.1:3000'
  // #ifdef APP-PLUS
  value = 'http://10.0.2.2:3000'
  // #endif
  const environment = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env
  return environment?.VITE_API_BASE_URL ?? value
}

export function normalizeServiceUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`
  const match = withProtocol.match(
    /^https?:\/\/(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?$/i,
  )
  const port = match?.[1] ? Number(match[1]) : null
  if (!match || (port !== null && (port < 1 || port > 65_535))) {
    throw new MobileClientError(
      '请输入正确的学习服务地址，例如 http://192.168.1.20:3000',
      422,
      'INVALID_SERVICE_URL',
    )
  }
  return withProtocol
}

function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string'
  )
}

function apiError(value: unknown, status: number): ApiError {
  return isApiError(value)
    ? value
    : {
        code: status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
        message: status === 0 ? '网络连接失败，请稍后重试' : '服务暂时不可用',
      }
}

export function createUniStorage(): MobileStorage {
  return {
    get(key) {
      const value = uni.getStorageSync(key) as unknown
      return typeof value === 'string' && value ? value : null
    },
    set(key, value) {
      uni.setStorageSync(key, value)
    },
    remove(key) {
      uni.removeStorageSync(key)
    },
  }
}

export function createUniTransport(
  serviceUrl: string | (() => string) = defaultServiceUrl(),
  runtime?: Pick<typeof uni, 'request' | 'downloadFile'>,
): MobileTransport {
  const getRuntime = () => runtime ?? uni
  const resolveBaseUrl = () => normalizeServiceUrl(
    typeof serviceUrl === 'function' ? serviceUrl() : serviceUrl,
  )
  const networkError = (result: { errMsg?: string } | undefined, action: '连接' | '下载') => {
    const timedOut = result?.errMsg?.toLowerCase().includes('timeout')
    return new MobileClientError(
      timedOut
        ? `${action}超时，请检查电脑服务是否已启动以及连接地址是否正确`
        : `${action}失败，请确认手机与电脑连接同一 Wi-Fi，并检查连接地址`,
      0,
      timedOut ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR',
    )
  }
  return {
    request<T>(input: MobileRequest) {
      return new Promise<MobileResponse<T>>((resolve, reject) => {
        getRuntime().request({
          url: `${resolveBaseUrl()}${input.path}`,
          method: input.method ?? 'GET',
          header: input.headers,
          data: input.data,
          timeout: mobileRequestTimeoutMs,
          success(response) {
            resolve({
              status: response.statusCode,
              data: response.data as T,
            })
          },
          fail(result) {
            reject(networkError(result, '连接'))
          },
        })
      })
    },
    download(path, headers) {
      return new Promise((resolve, reject) => {
        getRuntime().downloadFile({
          url: `${resolveBaseUrl()}${path}`,
          header: headers,
          timeout: mobileRequestTimeoutMs,
          success(response) {
            resolve({
              status: response.statusCode,
              tempFilePath: response.tempFilePath,
            })
          },
          fail(result) {
            reject(networkError(result, '下载'))
          },
        })
      })
    },
  }
}

export function createMobileStudentClient(options: {
  transport?: MobileTransport
  storage?: MobileStorage
} = {}): MobileStudentClient {
  const storage = options.storage ?? createUniStorage()
  const getServiceUrl = () => storage.get(mobileServiceUrlStorageKey) ?? defaultServiceUrl()
  const transport = options.transport ?? createUniTransport(getServiceUrl)

  function getAccessToken(): string | null {
    return storage.get(mobileTokenStorageKey)
  }

  function clearAccessToken(): void {
    storage.remove(mobileTokenStorageKey)
  }

  async function request<T>(input: MobileRequest, authenticated = true): Promise<T> {
    const token = authenticated ? getAccessToken() : null
    if (authenticated && !token) {
      clearAccessToken()
      throw new MobileClientError('请重新登录', 401, 'AUTH_REQUIRED')
    }
    let response: MobileResponse<T>
    try {
      response = await transport.request<T>({
        ...input,
        headers: {
          ...input.headers,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
    } catch (error) {
      if (error instanceof MobileClientError) throw error
      throw new MobileClientError('网络连接失败，请稍后重试', 0, 'NETWORK_ERROR')
    }
    if (response.status === 401) clearAccessToken()
    if (response.status < 200 || response.status >= 300) {
      const error = apiError(response.data, response.status)
      throw new MobileClientError(error.message, response.status, error.code)
    }
    return response.data
  }

  return {
    getServiceUrl,

    setServiceUrl(value) {
      const normalized = normalizeServiceUrl(value)
      if (normalized !== getServiceUrl()) clearAccessToken()
      storage.set(mobileServiceUrlStorageKey, normalized)
      return normalized
    },

    async checkConnection() {
      await request<unknown>({ path: '/health' }, false)
    },

    async login(username, password) {
      const login = await request<LoginResponse>(
        {
          path: '/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: { username: username.trim(), password },
        },
        false,
      )
      if (login.user.role !== 'STUDENT') {
        try {
          await transport.request({
            path: '/auth/logout',
            method: 'POST',
            headers: { Authorization: `Bearer ${login.accessToken}` },
          })
        } finally {
          clearAccessToken()
        }
        throw new MobileClientError('该账号不能进入学生学习空间', 403, 'FORBIDDEN')
      }
      storage.set(mobileTokenStorageKey, login.accessToken)
      return login.user
    },

    async restoreCurrentUser() {
      if (!getAccessToken()) return null
      const current = await request<CurrentUserResponse>({ path: '/auth/me' })
      if (current.user.role !== 'STUDENT') {
        clearAccessToken()
        throw new MobileClientError('该账号不能进入学生学习空间', 403, 'FORBIDDEN')
      }
      return current.user
    },

    async logout() {
      try {
        if (getAccessToken()) {
          await request<unknown>({ path: '/auth/logout', method: 'POST' })
        }
      } finally {
        clearAccessToken()
      }
    },

    getOverview() {
      return request<StudentOverview>({ path: '/student/overview' })
    },

    uploadFile(input) {
      return request<FileSummary>({
        path: `/student/files?name=${encodeURIComponent(input.name)}`,
        method: 'POST',
        headers: {
          'Content-Type': input.mimeType,
          'Content-Transfer-Encoding': 'base64',
        },
        data: input.base64,
      })
    },

    async downloadFile(fileId) {
      const token = getAccessToken()
      if (!token) {
        clearAccessToken()
        throw new MobileClientError('请重新登录', 401, 'AUTH_REQUIRED')
      }
      const response = await transport.download(`/files/${fileId}`, {
        Authorization: `Bearer ${token}`,
      })
      if (response.status === 401) clearAccessToken()
      if (response.status < 200 || response.status >= 300) {
        throw new MobileClientError('文件下载失败，请稍后重试', response.status, 'HTTP_ERROR')
      }
      return response.tempFilePath
    },

    submitWork(input) {
      return request<Submission>({
        path: '/student/submissions',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: input,
      })
    },

    getAccessToken,
    clearAccessToken,
  }
}

export const mobileStudentClient = createMobileStudentClient()
