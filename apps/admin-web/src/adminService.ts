import type {
  FeedbackWorkOrder,
  ScheduleChange,
} from '@k12/shared'

import type { AdminRole, Teacher } from './types'

export function filterByScope<T extends { campusId: number }>(
  items: readonly T[],
  role: AdminRole,
  campusId: number,
): T[] {
  if (role === 'SYSTEM_ADMIN') {
    return [...items]
  }

  return items.filter((item) => item.campusId === campusId)
}

export function ensureCampusAccess(
  targetCampusId: number,
  role: AdminRole,
  campusId: number,
): void {
  if (role === 'ACADEMIC_ADMIN' && targetCampusId !== campusId) {
    throw new Error('教务只能访问所属校区的数据')
  }
}

export function reviewScheduleChange(
  change: ScheduleChange,
  decision: 'APPROVED' | 'REJECTED',
  decisionNote: string,
  reviewerId: number,
  reviewedAt: string,
): ScheduleChange {
  if (change.status !== 'PENDING') {
    throw new Error('该申请已审批，不能重复处理')
  }

  const normalizedNote = decisionNote.trim()
  if (decision === 'REJECTED' && !normalizedNote) {
    throw new Error('拒绝调课时必须填写拒绝原因')
  }

  return {
    ...change,
    status: decision,
    decisionNote: normalizedNote,
    reviewedBy: reviewerId,
    reviewedAt,
    updatedAt: reviewedAt,
  }
}

export function assignSubstitute(
  change: ScheduleChange,
  substituteTeacherId: number,
  substituteNote: string,
  updatedAt: string,
): ScheduleChange {
  if (change.status !== 'APPROVED') {
    throw new Error('只有已通过的调课申请可以安排代课')
  }

  if (!Number.isInteger(substituteTeacherId) || substituteTeacherId <= 0) {
    throw new Error('请选择代课教师')
  }

  return {
    ...change,
    status: 'SUBSTITUTE_ASSIGNED',
    substituteTeacherId,
    substituteNote: substituteNote.trim(),
    updatedAt,
  }
}

export function availableSubstituteTeachers(
  change: ScheduleChange | undefined,
  teachers: readonly Teacher[],
): Teacher[] {
  if (!change) {
    return []
  }

  return teachers.filter(
    (teacher) =>
      teacher.campusId === change.campusId &&
      teacher.id !== change.originalTeacherId,
  )
}

export function startWorkOrder(
  workOrder: FeedbackWorkOrder,
  handlerId: number,
  updatedAt: string,
): FeedbackWorkOrder {
  if (workOrder.status === 'CLOSED') {
    throw new Error('已关闭工单不能重新处理')
  }

  return {
    ...workOrder,
    status: 'PROCESSING',
    handlerId,
    updatedAt,
  }
}

export function closeWorkOrder(
  workOrder: FeedbackWorkOrder,
  result: string,
  handlerId: number,
  closedAt: string,
): FeedbackWorkOrder {
  if (workOrder.status === 'CLOSED') {
    throw new Error('该工单已经关闭')
  }

  const normalizedResult = result.trim()
  if (!normalizedResult) {
    throw new Error('关闭工单前必须填写处理结果')
  }

  return {
    ...workOrder,
    status: 'CLOSED',
    handlerId,
    result: normalizedResult,
    updatedAt: closedAt,
    closedAt,
  }
}
