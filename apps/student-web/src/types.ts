export type UserRole = 'STUDENT'

export type SubmissionStatus = 'SUBMITTED' | 'GRADED' | 'REVISION_REQUIRED'

export type SubmissionViewStatus = SubmissionStatus | 'NOT_SUBMITTED'

export type StudentPage =
  | 'login'
  | 'home'
  | 'courseware'
  | 'assignments'
  | 'assignmentDetail'
  | 'submission'
  | 'result'

export interface StudentUser {
  id: number
  displayName: string
  role: UserRole
  campusId: number
  campusName: string
  classId: number
  className: string
}

export interface FileSummary {
  id: number
  originalName: string
  mimeType: string
  byteSize: number
  createdAt: string
}

export interface CoursewareMaterial {
  id: number
  courseId: number
  courseName: string
  title: string
  description: string
  file: FileSummary
  publishedAt: string
}

export interface Assignment {
  id: number
  campusId: number
  classId: number
  courseId: number
  scheduleId?: number
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
  score?: number
  teacherComment: string
  gradedBy?: number
  gradedAt?: string
  updatedAt: string
}
