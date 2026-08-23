import type {
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChangeNotice,
  StudentFeedback,
} from '@k12/shared'

export type ParentNoticeItem = Notification | ScheduleChangeNotice
export type FeedbackResponseDrafts = Readonly<Record<number, string>>

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

export function countUnreadNotifications(
  notices: readonly ParentNoticeItem[],
): number {
  return notices.filter((item) => {
    const notification = 'notification' in item ? item.notification : item
    return !notification.readAt
  }).length
}

export function mergeParentNotices(
  notifications: readonly Notification[],
  scheduleChangeNotices: readonly ScheduleChangeNotice[],
): ParentNoticeItem[] {
  const scheduleNotificationIds = new Set(
    scheduleChangeNotices.map((item) => item.notification.id),
  )

  return [
    ...scheduleChangeNotices,
    ...notifications.filter(
      (notification) => !scheduleNotificationIds.has(notification.id),
    ),
  ]
}

export function canMarkNotificationRead(
  notification: Notification,
  savingNotificationId: number | null,
): boolean {
  return !notification.readAt && savingNotificationId !== notification.id
}

export function canSubmitFeedbackResponse(
  feedback: StudentFeedback,
  isSavingFeedback: boolean,
): boolean {
  return !isSavingFeedback && feedback.status === 'PENDING_PARENT'
}

export function feedbackResponseDraft(
  drafts: FeedbackResponseDrafts,
  feedbackId: number,
): string {
  return drafts[feedbackId] ?? ''
}

export function updateFeedbackResponseDraft(
  drafts: FeedbackResponseDrafts,
  feedbackId: number,
  value: string,
): FeedbackResponseDrafts {
  return { ...drafts, [feedbackId]: value }
}

export function clearFeedbackResponseDraft(
  drafts: FeedbackResponseDrafts,
  feedbackId: number,
): FeedbackResponseDrafts {
  const nextDrafts = { ...drafts }
  delete nextDrafts[feedbackId]
  return nextDrafts
}

export function isLatestOverviewRequest(
  requestSequence: number,
  latestRequestSequence: number,
): boolean {
  return requestSequence === latestRequestSequence
}

export function isCurrentStudentAction(
  actionStudentId: number,
  selectedStudentId: number | null,
): boolean {
  return actionStudentId === selectedStudentId
}

export function leaveStatusLabel(status: LeaveRequest['status']): string {
  const labels: Record<LeaveRequest['status'], string> = {
    PENDING: '待审批',
    APPROVED: '已批准',
    REJECTED: '已拒绝',
  }

  return labels[status]
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
