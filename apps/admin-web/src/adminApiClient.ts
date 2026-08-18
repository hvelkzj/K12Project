import type {
  AdminOverview,
} from './adminTypes'
import { ACCESS_TOKEN_KEY } from './authService'

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AdminApiError'
  }
}

export interface AdminApiClient {
  loadOverview(): Promise<AdminOverview>
  reviewScheduleChange(input: {
    changeId: number
    decision: 'APPROVED' | 'REJECTED'
    decisionNote: string
  }): Promise<import('./types').ScheduleChange>
  assignSubstitute(input: {
    changeId: number
    substituteTeacherId: number
    substituteNote: string
  }): Promise<import('./types').ScheduleChange>
  updateWorkOrder(input: {
    workOrderId: number
    action: 'START' | 'CLOSE'
    result?: string
  }): Promise<import('./types').FeedbackWorkOrder>
}

export interface AdminApiClientOptions {
  apiBaseUrl: string
  fetchImpl?: typeof fetch
  storage?: Pick<Storage, 'getItem'>
  onUnauthorized?: () => void | Promise<void>
}

export function createAdminApiClient(
  options: AdminApiClientOptions,
): AdminApiClient {
  const apiBaseUrl = options.apiBaseUrl
  const fetchImpl = options.fetchImpl ?? fetch
  const storage = options.storage ?? sessionStorage
  const onUnauthorized = options.onUnauthorized ?? (() => {})

  function accessToken(): string {
    const token = storage.getItem(ACCESS_TOKEN_KEY)
    if (!token) {
      throw new AdminApiError(401, 'AUTH_REQUIRED', '请先登录')
    }
    return token
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const token = accessToken()

    let response: Response
    try {
      response = await fetchImpl(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      })
    } catch {
      throw new AdminApiError(0, 'NETWORK_ERROR', '网络请求失败，请稍后重试')
    }

    if (response.status === 401) {
      await onUnauthorized()
      throw new AdminApiError(401, 'AUTH_REQUIRED', '登录已失效，请重新登录')
    }

    if (!response.ok) {
      let code = 'REQUEST_FAILED'
      let message = '请求失败，请稍后重试'
      try {
        const body = (await response.json()) as {
          code?: string
          message?: string
        }
        if (body.code) code = body.code
        if (body.message) message = body.message
      } catch {
        // 保留默认错误
      }
      throw new AdminApiError(response.status, code, message)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  return {
    loadOverview() {
      return request<AdminOverview>('/admin/overview')
    },

    reviewScheduleChange(input) {
      return request(`/admin/schedule-changes/${input.changeId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision: input.decision,
          decisionNote: input.decisionNote,
        }),
      })
    },

    assignSubstitute(input) {
      return request(`/admin/schedule-changes/${input.changeId}/substitute`, {
        method: 'PATCH',
        body: JSON.stringify({
          substituteTeacherId: input.substituteTeacherId,
          substituteNote: input.substituteNote,
        }),
      })
    },

    updateWorkOrder(input) {
      const body: Record<string, string> = { action: input.action }
      if (input.action === 'CLOSE') {
        body.result = input.result ?? ''
      }

      return request(`/admin/work-orders/${input.workOrderId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
  }
}
