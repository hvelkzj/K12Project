import type {
  ApiError,
  AttendanceSaveRequest,
  AssignmentCreateRequest,
  FeedbackCreateRequest,
  ScheduleChangeApplyRequest,
  SubmissionPatchRequest,
  TeacherOverviewResponse,
} from '@k12/shared'
import { DEFAULT_API_BASE_URL } from './authClient'

export interface TeacherApiClientOptions {
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  getAccessToken: () => string | null
}

export class TeacherApiClient {
  private readonly apiBaseUrl: string
  private readonly fetch: typeof fetch
  private readonly getAccessToken: () => string | null

  constructor(options: TeacherApiClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL
    this.fetch = options.fetchImpl ?? fetch
    this.getAccessToken = options.getAccessToken
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken()
    const headers = new Headers(init.headers)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const resp = await this.fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers,
    })

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => null)
      const error: ApiError = {
        status: resp.status,
        message: errBody?.message ?? '请求失败',
      }
      throw error
    }
    return resp.json()
  }

  // 1.教师概览 GET /teacher/overview
  async getOverview(): Promise<TeacherOverviewResponse> {
    return this.request('/teacher/overview', { method: 'GET' })
  }

  // 2.保存签到 PUT /teacher/attendance
  async saveAttendance(body: AttendanceSaveRequest) {
    return this.request('/teacher/attendance', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  //3.发布作业 POST /teacher/assignments
  async createAssignment(body: AssignmentCreateRequest) {
    return this.request('/teacher/assignments', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  //4.批改作业 PATCH /teacher/submissions/:submissionId
  async patchSubmission(submissionId: number, body: SubmissionPatchRequest) {
    return this.request(`/teacher/submissions/${submissionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  //5.课后反馈 POST /teacher/feedback
  async createFeedback(body: FeedbackCreateRequest) {
    return this.request('/teacher/feedback', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  //6.调课申请 POST /teacher/schedule‑changes
  async applyScheduleChange(body: ScheduleChangeApplyRequest) {
    return this.request('/teacher/schedule‑changes', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}