import type {
  ApiError,
  Assignment,
  CourseSummary,
  Courseware,
  FileSummary,
  StudentSummary,
  Submission,
  UserSummary,
} from '@k12/shared'

import {
  authService,
  defaultApiBaseUrl,
} from './services/authService'
import type { StudentAuthClient } from './services/authService'

export interface StudentOverview {
  student: StudentSummary
  courses: CourseSummary[]
  teachers: UserSummary[]
  courseware: Courseware[]
  assignments: Assignment[]
  submissions: Submission[]
}

export interface SubmitWorkInput {
  assignmentId: number
  content: string
  attachments: FileSummary[]
}

export interface StudentBusinessClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  authClient?: Pick<
    StudentAuthClient,
    'getAccessToken' | 'clearAccessToken'
  >
}

export interface StudentBusinessClient {
  getOverview(): Promise<StudentOverview>
  submitWork(input: SubmitWorkInput): Promise<Submission>
}

export class StudentBusinessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'StudentBusinessError'
  }
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

async function readApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as unknown
    if (isApiError(body)) return body
  } catch {
    // Use the stable fallback below for empty or invalid response bodies.
  }

  return {
    code: response.status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
    message: '业务服务暂时不可用',
  }
}

export function createStudentBusinessClient(
  options: StudentBusinessClientOptions = {},
): StudentBusinessClient {
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
  const authClient = options.authClient ?? authService

  async function requestJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const accessToken = authClient.getAccessToken()
    if (!accessToken) {
      authClient.clearAccessToken()
      throw new StudentBusinessError('请重新登录', 401, 'AUTH_REQUIRED')
    }

    let response: Response
    try {
      response = await fetchImpl(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      })
    } catch (error) {
      throw new StudentBusinessError(
        error instanceof Error ? error.message : '网络请求失败',
        0,
        'NETWORK_ERROR',
      )
    }

    if (response.status === 401) {
      authClient.clearAccessToken()
    }

    if (!response.ok) {
      const apiError = await readApiError(response)
      throw new StudentBusinessError(
        apiError.message,
        response.status,
        apiError.code,
      )
    }

    return (await response.json()) as T
  }

  return {
    getOverview() {
      return requestJson<StudentOverview>('/student/overview')
    },

    submitWork(input) {
      return requestJson<Submission>('/student/submissions', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}

export const studentBusinessClient = createStudentBusinessClient()
