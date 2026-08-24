import type {
  AttendanceStatus,
  FeedbackStatus,
  LeaveStatus,
  NotificationType,
  PublicRegistrationRole,
  ScheduleChangeStatus,
  ScheduleStatus,
  SubmissionStatus,
  UserRole,
  WorkOrderStatus,
} from './constants.js'

export interface CampusSummary {
  id: number
  name: string
}

export interface ClassSummary {
  id: number
  campusId: number
  name: string
}

export interface CourseSummary {
  id: number
  campusId: number
  name: string
  subject: string
}

export interface UserSummary {
  id: number
  displayName: string
  role: UserRole
  campusId: number
  campusName?: string | null
}

export interface UserAccountSummary extends UserSummary {
  username: string
  active: boolean
}

export interface StudentSummary {
  id: number
  displayName: string
  classId: number
  className: string
  campusId: number
  campusName: string
}

export interface FileSummary {
  id: number
  originalName: string
  mimeType: string
  byteSize: number
  createdAt: string
}

export interface ScheduleSummary {
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

export interface ParentStudentBinding {
  parentId: number
  student: StudentSummary
  relationship: string
  createdAt: string
}

export interface LeaveRequest {
  id: number
  parentId: number
  studentId: number
  scheduleId: number
  reason: string
  contactPhone: string
  status: LeaveStatus
  reviewedBy?: number | null
  reviewNote: string
  reviewedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: number
  userId: number
  studentId?: number | null
  type: NotificationType
  title: string
  content: string
  relatedType: string
  relatedId?: number | null
  readAt?: string | null
  createdAt: string
}

export interface ScheduleChangeNotice {
  notification: Notification
  originalDate: string
  originalStartTime: string
  originalEndTime: string
  newDate: string
  newStartTime: string
  newEndTime: string
  originalTeacherName: string
  substituteTeacherName?: string | null
}

export interface Courseware {
  id: number
  classId: number
  courseId: number
  teacherId: number
  title: string
  description: string
  attachments: FileSummary[]
  publishedAt: string
}

export interface Assignment {
  id: number
  campusId: number
  classId: number
  courseId: number
  scheduleId?: number | null
  teacherId: number
  title: string
  description: string
  attachments: FileSummary[]
  dueAt: string
  allowLate: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface Submission {
  id: number
  assignmentId: number
  studentId: number
  attempt: number
  content: string
  attachments: FileSummary[]
  status: SubmissionStatus
  submittedAt: string
  score?: number | null
  teacherComment: string
  gradedBy?: number | null
  gradedAt?: string | null
  updatedAt: string
}

export interface AttendanceRecord {
  id: number
  scheduleId: number
  studentId: number
  status: AttendanceStatus
  note: string
  recordedBy: number
  recordedAt: string
}

export interface StudentFeedback {
  id: number
  campusId: number
  scheduleId: number
  studentId: number
  teacherId: number
  performance: string
  strengths: string
  improvements: string
  suggestion: string
  status: FeedbackStatus
  parentResponse: string
  respondedBy?: number | null
  respondedAt?: string | null
  sentAt: string
  updatedAt: string
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
  reviewedBy?: number | null
  reviewedAt?: string | null
  substituteTeacherId?: number | null
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
  handlerId?: number | null
  result: string
  createdAt: string
  updatedAt: string
  closedAt?: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  displayName: string
  role: PublicRegistrationRole
}

export interface RegisterResponse {
  user: UserAccountSummary
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  user: UserSummary
}

export interface CurrentUserResponse {
  user: UserSummary
}

export interface ApiError {
  code: string
  message: string
}
