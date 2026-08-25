export const BUSINESS_STATUS_LABELS = {
  SCHEDULED: '待上课',
  CHANGED: '已调课',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  PRESENT: '已出勤',
  LATE: '迟到',
  ABSENT: '缺勤',
  LEAVE: '请假',
  SUBMITTED: '已提交，待批改',
  GRADED: '已批改',
  REVISION_REQUIRED: '需要订正',
  SUBSTITUTE_ASSIGNED: '已安排代课',
  PENDING_PARENT: '待家长确认',
  CONFIRMED: '家长已确认',
  DISPUTED: '家长有异议',
  OPEN: '待处理',
  PROCESSING: '处理中',
  CLOSED: '已关闭',
} as const

export function getBusinessStatusLabel(status: string): string {
  return Object.hasOwn(BUSINESS_STATUS_LABELS, status)
    ? BUSINESS_STATUS_LABELS[
        status as keyof typeof BUSINESS_STATUS_LABELS
      ]
    : status
}
