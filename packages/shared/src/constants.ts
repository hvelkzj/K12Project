export const USER_ROLES = [
  'PARENT',
  'STUDENT',
  'TEACHER',
  'HOMEROOM_TEACHER',
  'ACADEMIC_ADMIN',
  'SYSTEM_ADMIN',
] as const

export type UserRole = (typeof USER_ROLES)[number]

export const SCHEDULE_STATUSES = [
  'SCHEDULED',
  'CHANGED',
  'COMPLETED',
  'CANCELLED',
] as const

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'LEAVE',
] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const SUBMISSION_STATUSES = [
  'SUBMITTED',
  'GRADED',
  'REVISION_REQUIRED',
] as const

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const SCHEDULE_CHANGE_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUBSTITUTE_ASSIGNED',
  'COMPLETED',
] as const

export type ScheduleChangeStatus =
  (typeof SCHEDULE_CHANGE_STATUSES)[number]

export const FEEDBACK_STATUSES = [
  'PENDING_PARENT',
  'CONFIRMED',
  'DISPUTED',
] as const

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const WORK_ORDER_STATUSES = ['OPEN', 'PROCESSING', 'CLOSED'] as const

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'SCHEDULE_CHANGE',
  'FEEDBACK',
  'GENERAL',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
