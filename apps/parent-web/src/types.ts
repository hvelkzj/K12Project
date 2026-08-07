export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type NoticeType = 'SCHEDULE_CHANGE' | 'FEEDBACK' | 'GENERAL'
export type FeedbackStatus = 'PENDING_PARENT' | 'CONFIRMED' | 'DISPUTED'

export interface ParentUser {
  id: number
  displayName: string
  phone: string
  boundStudentIds: number[]
}

export interface Student {
  id: number
  displayName: string
  classId: number
  className: string
  campusId: number
  campusName: string
}

export interface ScheduleItem {
  id: number
  studentId: number
  lessonDate: string
  startTime: string
  endTime: string
  courseName: string
  teacherName: string
  roomName: string
}

export interface LeaveRequest {
  id: number
  parentId: number
  studentId: number
  scheduleId: number
  reason: string
  contactPhone: string
  status: LeaveStatus
  createdAt: string
  updatedAt: string
}

export interface ParentNotice {
  id: number
  studentId: number
  type: NoticeType
  title: string
  content: string
  originalTime?: string
  newTime?: string
  substituteTeacherName?: string
  createdAt: string
  readAt: string | null
}

export interface StudentFeedback {
  id: number
  studentId: number
  courseName: string
  teacherName: string
  strengths: string
  improvements: string
  suggestion: string
  status: FeedbackStatus
  parentResponse: string
}
