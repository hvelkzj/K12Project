import type {
  Notification,
  ParentStudentBinding,
  ScheduleChangeNotice,
  StudentFeedback,
} from '@k12/shared'

export function overviewRetryStudentId(
  bindings: readonly ParentStudentBinding[],
  selectedStudentId: number | null,
): number | null {
  if (selectedStudentId === null) return null

  return bindings.some(
    (binding) => binding.student.id === selectedStudentId,
  )
    ? selectedStudentId
    : null
}

export function countPendingParentFeedback(
  feedback: readonly StudentFeedback[],
): number {
  return feedback.filter((item) => item.status === 'PENDING_PARENT').length
}

export function replaceReadNotification(
  notifications: readonly Notification[],
  updated: Notification,
): Notification[] {
  return notifications.map((item) =>
    item.id === updated.id ? updated : item,
  )
}

export function replaceReadScheduleChangeNotice(
  notices: readonly ScheduleChangeNotice[],
  updated: Notification,
): ScheduleChangeNotice[] {
  return notices.map((item) =>
    item.notification.id === updated.id
      ? { ...item, notification: updated }
      : item,
  )
}
