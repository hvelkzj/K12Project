import type {
  CampusSummary,
  ClassSummary,
  CourseSummary,
  FeedbackWorkOrder,
  ScheduleChange,
  ScheduleChangeStatus,
  ScheduleStatus,
  ScheduleSummary,
  UserAccountSummary,
  UserRole,
  WorkOrderStatus,
} from '@k12/shared'

export type AdminRole = Extract<
  UserRole,
  'ACADEMIC_ADMIN' | 'SYSTEM_ADMIN'
>

export type Campus = CampusSummary
export type ClassGroup = ClassSummary
export type Course = CourseSummary
export type Schedule = ScheduleSummary
export type UserAccount = UserAccountSummary

export type {
  FeedbackWorkOrder,
  ScheduleChange,
  ScheduleChangeStatus,
  ScheduleStatus,
  UserRole,
  WorkOrderStatus,
}

export interface Teacher {
  id: number
  campusId: number
  displayName: string
}
