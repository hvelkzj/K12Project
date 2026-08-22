import type {
  ApiError,
  CourseSummary,
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChangeNotice,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
  UserSummary,
} from '@k12/shared'

import { defaultApiBaseUrl, parentAuthClient } from './authClient'
import type { ParentAuthClient } from './authClient'

export interface ParentOverview {
  student: StudentSummary
  schedules: ScheduleSummary[]
  courses: CourseSummary[]
  teachers: UserSummary[]
  leaveRequests: LeaveRequest[]
  notifications: Notification[]
  scheduleChangeNotices: ScheduleChangeNotice[]
  feedback: StudentFeedback[]
}

export interface LeaveRequestInput {
  studentId: number
  scheduleId: number
  reason: string
  contactPhone: string
}

export interface FeedbackResponseInput {
  status: 'CONFIRMED' | 'DISPUTED'
  parentResponse: string
}

export interface ParentBusinessClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  authClient?: Pick<
    ParentAuthClient,
    'getAccessToken' | 'clearAccessToken'
  >
}

export interface ParentBusinessClient {
  listStudents(): Promise<ParentStudentBinding[]>
  getOverview(studentId: number): Promise<ParentOverview>
  submitLeaveRequest(input: LeaveRequestInput): Promise<LeaveRequest>
  markNotificationRead(notificationId: number): Promise<Notification>
  respondToFeedback(
    feedbackId: number,
    input: FeedbackResponseInput,
  ): Promise<StudentFeedback>
}

export class ParentBusinessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ParentBusinessError'
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
    // Use a stable fallback when the API fails before returning JSON.
  }

  return {
    code: response.status === 0 ? 'NETWORK_ERROR' : 'HTTP_ERROR',
    message: '业务服务暂时不可用',
  }
}

export function createParentBusinessClient(
  options: ParentBusinessClientOptions = {},
): ParentBusinessClient {
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
  const authClient = options.authClient ?? parentAuthClient

  async function requestJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const accessToken = authClient.getAccessToken()
    if (!accessToken) {
      authClient.clearAccessToken()
      throw new ParentBusinessError('请重新登录', 401, 'AUTH_REQUIRED')
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
      throw new ParentBusinessError(
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
      throw new ParentBusinessError(
        apiError.message,
        response.status,
        apiError.code,
      )
    }

    return (await response.json()) as T
  }

  return {
    listStudents() {
      return requestJson<ParentStudentBinding[]>('/parent/students')
    },

    getOverview(studentId) {
      return requestJson<ParentOverview>(
        `/parent/students/${studentId}/overview`,
      )
    },

    submitLeaveRequest(input) {
      return requestJson<LeaveRequest>('/parent/leave-requests', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    markNotificationRead(notificationId) {
      return requestJson<Notification>(
        `/parent/notifications/${notificationId}/read`,
        {
          method: 'PATCH',
          body: JSON.stringify({ read: true }),
        },
      )
    },

    respondToFeedback(feedbackId, input) {
      return requestJson<StudentFeedback>(`/parent/feedback/${feedbackId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    },
  }
}

export const parentBusinessClient = createParentBusinessClient()
