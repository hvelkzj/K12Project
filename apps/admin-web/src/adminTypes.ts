import type {
  CampusSummary,
  ClassSummary,
  CourseSummary,
  FeedbackWorkOrder,
  ScheduleChange,
  ScheduleSummary,
  UserAccountSummary,
  UserSummary,
} from '@k12/shared'

export interface AdminOverview {
  campuses: CampusSummary[]
  classes: ClassSummary[]
  courses: CourseSummary[]
  schedules: ScheduleSummary[]
  users: UserAccountSummary[]
  teachers: UserSummary[]
  scheduleChanges: ScheduleChange[]
  feedbackWorkOrders: FeedbackWorkOrder[]
}
