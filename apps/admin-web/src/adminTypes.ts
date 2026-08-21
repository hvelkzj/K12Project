import type {
  CampusSummary,
  ClassSummary,
  CourseSummary,
  FeedbackWorkOrder,
  LeaveRequest,
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
  leaveRequests: LeaveRequest[]
}

export interface CreateScheduleInput {
  campusId: number
  classId: number
  courseId: number
  teacherId: number
  lessonDate: string
  startTime: string
  endTime: string
  room: string
}

export interface UpdateScheduleInput {
  teacherId?: number
  lessonDate?: string
  startTime?: string
  endTime?: string
  room?: string
  status?: 'SCHEDULED' | 'CANCELLED'
}
