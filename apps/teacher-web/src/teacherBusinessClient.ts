import type {
  ApiError,
  Assignment,
  AttendanceRecord,
  AttendanceStatus,
  CampusSummary,
  ClassSummary,
  CourseSummary,
  FileSummary,
  ScheduleChange,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
  Submission,
} from '@k12/shared'

import {
  DEFAULT_API_BASE_URL,
  teacherAuthClient,
  type TeacherAuthClient,
} from './authClient'

export interface TeacherOverview {
  campuses: CampusSummary[]
  classes: ClassSummary[]
  students: StudentSummary[]
  courses: CourseSummary[]
  schedules: ScheduleSummary[]
  attendance: AttendanceRecord[]
  assignments: Assignment[]
  submissions: Submission[]
  feedback: StudentFeedback[]
  scheduleChanges: ScheduleChange[]
}

export interface AttendanceInput {
  scheduleId: number
  records: Array<{
    studentId: number
    status: AttendanceStatus
    note: string
  }>
}

export interface AssignmentInput {
  classId: number
  courseId: number
  scheduleId?: number
  title: string
  description: string
  attachments: FileSummary[]
  dueAt: string
  allowLate: boolean
}

export interface GradeInput {
  score: number
  teacherComment: string
  correctionRequired: boolean
}

export interface FeedbackInput {
  scheduleId: number
  studentId: number
  performance: string
  strengths: string
  improvements: string
  suggestion: string
}

export interface ScheduleChangeInput {
  scheduleId: number
  reason: string
  proposedDate: string
  proposedStartTime: string
  proposedEndTime: string
}

export interface TeacherBusinessClient {
  loadOverview(): Promise<TeacherOverview>
  saveAttendance(input: AttendanceInput): Promise<AttendanceRecord[]>
  publishAssignment(input: AssignmentInput): Promise<Assignment>
  gradeSubmission(submissionId: number, input: GradeInput): Promise<Submission>
  sendFeedback(input: FeedbackInput): Promise<StudentFeedback>
  requestScheduleChange(input: ScheduleChangeInput): Promise<ScheduleChange>
}

export interface TeacherBusinessClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  authClient?: Pick<TeacherAuthClient, 'getAccessToken' | 'clearAccessToken'>
}

export class TeacherBusinessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = 'TeacherBusinessError'
  }
}

function normalizeApiBaseUrl(value: string): string {
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

async function readApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as unknown
    if (isApiError(body)) return body
  } catch {
    // Keep a stable fallback when the API cannot return JSON.
  }

  return { code: 'HTTP_ERROR', message: '业务服务暂时不可用' }
}

export function createTeacherBusinessClient(
  options: TeacherBusinessClientOptions = {},
): TeacherBusinessClient {
  const viteEnv = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>
    }
  ).env
  const apiBaseUrl = normalizeApiBaseUrl(
    options.apiBaseUrl ??
      viteEnv?.VITE_API_BASE_URL ??
      DEFAULT_API_BASE_URL,
  )
  const fetchImpl = options.fetchImpl ?? fetch
  const authClient = options.authClient ?? teacherAuthClient

  async function requestJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const accessToken = authClient.getAccessToken()
    if (!accessToken) {
      authClient.clearAccessToken()
      throw new TeacherBusinessError('请重新登录', 401, 'AUTH_REQUIRED')
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
      throw new TeacherBusinessError(
        error instanceof Error ? error.message : '网络请求失败',
        0,
        'NETWORK_ERROR',
      )
    }

    if (response.status === 401) authClient.clearAccessToken()
    if (!response.ok) {
      const apiError = await readApiError(response)
      throw new TeacherBusinessError(
        apiError.message,
        response.status,
        apiError.code,
      )
    }

    return (await response.json()) as T
  }

  return {
    loadOverview() {
      return requestJson<TeacherOverview>('/teacher/overview')
    },

    saveAttendance(input) {
      return requestJson<AttendanceRecord[]>('/teacher/attendance', {
        method: 'PUT',
        body: JSON.stringify(input),
      })
    },

    publishAssignment(input) {
      return requestJson<Assignment>('/teacher/assignments', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    gradeSubmission(submissionId, input) {
      return requestJson<Submission>(
        `/teacher/submissions/${submissionId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
      )
    },

    sendFeedback(input) {
      return requestJson<StudentFeedback>('/teacher/feedback', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    requestScheduleChange(input) {
      return requestJson<ScheduleChange>('/teacher/schedule-changes', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}

export const teacherBusinessClient = createTeacherBusinessClient()
