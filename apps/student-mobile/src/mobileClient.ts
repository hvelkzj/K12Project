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

function defaultServiceUrl(): string {
  let value = 'http://127.0.0.1:3000'
  // #ifdef APP-PLUS
  value = 'http://10.0.2.2:3000'
  // #endif
  const environment = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env
  return environment?.VITE_API_BASE_URL ?? value
}

function normalizeServiceUrl(value: string): string {
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
  serviceUrl = defaultServiceUrl(),
): MobileTransport {
  const baseUrl = normalizeServiceUrl(serviceUrl)
  return {
    request<T>(input: MobileRequest) {
      return new Promise<MobileResponse<T>>((resolve, reject) => {
        uni.request({
          url: `${baseUrl}${input.path}`,
          method: input.method ?? 'GET',
          header: input.headers,
          data: input.data,
          success(response) {
            resolve({
              status: response.statusCode,
              data: response.data as T,
            })
          },
          fail() {
            reject(new MobileClientError('网络连接失败，请稍后重试', 0, 'NETWORK_ERROR'))
          },
        })
      })
    },
    download(path, headers) {
      return new Promise((resolve, reject) => {
        uni.downloadFile({
          url: `${baseUrl}${path}`,
          header: headers,
          success(response) {
            resolve({
              status: response.statusCode,
              tempFilePath: response.tempFilePath,
            })
          },
          fail() {
            reject(new MobileClientError('文件下载失败，请稍后重试', 0, 'NETWORK_ERROR'))
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
  const transport = options.transport ?? createUniTransport()
  const storage = options.storage ?? createUniStorage()

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
