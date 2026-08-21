import type {
  Assignment,
  AttendanceRecord,
  CampusSummary,
  ClassSummary,
  CourseSummary,
  Courseware,
  FeedbackWorkOrder,
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChange,
  ScheduleChangeNotice,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
  Submission,
  UserAccountSummary,
  UserSummary,
} from '@k12/shared'

export interface ParentOverview {
  student: StudentSummary
  schedules: ScheduleSummary[]
  courses: CourseSummary[]
  teachers: UserSummary[]
  leaveRequests: LeaveRequest[]
  notifications: Notification[]
  scheduleChangeNotices: ScheduleChangeNotice[]
  feedback: StudentFeedback[]
}

export interface StudentOverview {
  student: StudentSummary
  courses: CourseSummary[]
  teachers: UserSummary[]
  courseware: Courseware[]
  assignments: Assignment[]
  submissions: Submission[]
}

export interface TeacherOverview {
  campuses: CampusSummary[]
  classes: ClassSummary[]
  students: StudentSummary[]
  courses: CourseSummary[]
  schedules: ScheduleSummary[]
  attendance: AttendanceRecord[]
  assignments: Assignment[]
  submissions: Submission[]
  feedback: StudentFeedback[]
  scheduleChanges: ScheduleChange[]
  leaveRequests: LeaveRequest[]
}

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

export type BusinessInput = Record<string, unknown>

export interface BusinessStore {
  listParentStudents(user: UserSummary): ParentStudentBinding[]
  getParentOverview(user: UserSummary, studentId: number): ParentOverview
  submitLeaveRequest(user: UserSummary, input: BusinessInput): LeaveRequest
  respondToFeedback(
    user: UserSummary,
    feedbackId: number,
    input: BusinessInput,
  ): StudentFeedback
  markNotificationRead(
    user: UserSummary,
    notificationId: number,
    input: BusinessInput,
  ): Notification
  getStudentOverview(user: UserSummary): StudentOverview
  submitStudentWork(user: UserSummary, input: BusinessInput): Submission
  getTeacherOverview(user: UserSummary): TeacherOverview
  saveAttendance(
    user: UserSummary,
    input: BusinessInput,
  ): AttendanceRecord[]
  publishAssignment(user: UserSummary, input: BusinessInput): Assignment
  gradeSubmission(
    user: UserSummary,
    submissionId: number,
    input: BusinessInput,
  ): Submission
  sendFeedback(user: UserSummary, input: BusinessInput): StudentFeedback
  requestScheduleChange(
    user: UserSummary,
    input: BusinessInput,
  ): ScheduleChange
  getAdminOverview(user: UserSummary): AdminOverview
  reviewScheduleChange(
    user: UserSummary,
    changeId: number,
    input: BusinessInput,
  ): ScheduleChange
  assignSubstitute(
    user: UserSummary,
    changeId: number,
    input: BusinessInput,
  ): ScheduleChange
  updateWorkOrder(
    user: UserSummary,
    workOrderId: number,
    input: BusinessInput,
  ): FeedbackWorkOrder
  reviewLeaveRequest(
    user: UserSummary,
    leaveRequestId: number,
    input: BusinessInput,
  ): LeaveRequest
  createSchedule(user: UserSummary, input: BusinessInput): ScheduleSummary
  updateSchedule(
    user: UserSummary,
    scheduleId: number,
    input: BusinessInput,
  ): ScheduleSummary
  updateUserAccount(
    user: UserSummary,
    userId: number,
    input: BusinessInput,
  ): UserAccountSummary
  reset(): void
}
