export type AdminRole = 'ACADEMIC_ADMIN' | 'SYSTEM_ADMIN'

export type UserRole =
  | 'PARENT'
  | 'STUDENT'
  | 'TEACHER'
  | 'HOMEROOM_TEACHER'
  | AdminRole

export type ScheduleStatus =
  | 'SCHEDULED'
  | 'CHANGED'
  | 'COMPLETED'
  | 'CANCELLED'

export type ScheduleChangeStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBSTITUTE_ASSIGNED'
  | 'COMPLETED'

export type WorkOrderStatus = 'OPEN' | 'PROCESSING' | 'CLOSED'

export interface Campus {
  id: number
  name: string
}

export interface ClassGroup {
  id: number
  campusId: number
  name: string
}

export interface Course {
  id: number
  name: string
}

export interface Teacher {
  id: number
  campusId: number
  displayName: string
}

export interface Schedule {
  id: number
  campusId: number
  classId: number
  courseId: number
  teacherId: number
  lessonDate: string
  startTime: string
  endTime: string
  room: string
  status: ScheduleStatus
}

export interface ScheduleChange {
  id: number
  campusId: number
  scheduleId: number
  requestedBy: number
  reason: string
  originalTeacherId: number
  originalDate: string
  originalStartTime: string
  originalEndTime: string
  proposedDate: string
  proposedStartTime: string
  proposedEndTime: string
  status: ScheduleChangeStatus
  decisionNote: string
  reviewedBy?: number
  reviewedAt?: string
  substituteTeacherId?: number
  substituteNote: string
  createdAt: string
  updatedAt: string
}

export interface FeedbackWorkOrder {
  id: number
  feedbackId: number
  campusId: number
  issue: string
  status: WorkOrderStatus
  handlerId?: number
  result: string
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export interface UserAccount {
  id: number
  campusId: number
  displayName: string
  account: string
  role: UserRole
  enabled: boolean
}
