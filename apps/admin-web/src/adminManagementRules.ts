import type { LeaveRequest, UserAccountSummary } from '@k12/shared'

export interface ManagementActionState {
  pendingKey: string | null
}

export type ManagementActionResult<T> =
  | { started: false }
  | { started: true; value: T }

export function validateScheduleTime(startTime: string, endTime: string): string | null {
  if (startTime >= endTime) {
    return '结束时间必须晚于开始时间'
  }
  return null
}

export function validateRequiredText(value: string, message: string): string | null {
  if (!value.trim()) {
    return message
  }
  return null
}

export function canDisableCurrentAdmin(
  user: UserAccountSummary,
  currentAdmin: { id: number } | null | undefined,
): boolean {
  if (!currentAdmin) return true

  const isCurrent = user.id === currentAdmin.id
  const isAdminRole = user.role === 'SYSTEM_ADMIN'
  const isActive = user.active

  return !(isCurrent && isAdminRole && isActive)
}

export function canManageUser(
  role: string | undefined,
): boolean {
  return role === 'SYSTEM_ADMIN'
}

export function canReviewLeaveRequest(
  status: LeaveRequest['status'],
): boolean {
  return status === 'PENDING'
}

export function isScheduleIdentityLocked(
  editingScheduleId: number | null,
): boolean {
  return editingScheduleId !== null
}

export async function runManagementAction<T>(
  state: ManagementActionState,
  key: string,
  action: () => Promise<T>,
): Promise<ManagementActionResult<T>> {
  if (state.pendingKey !== null) return { started: false }

  state.pendingKey = key
  try {
    return { started: true, value: await action() }
  } finally {
    if (state.pendingKey === key) state.pendingKey = null
  }
}
