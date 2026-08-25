import type { SubmissionStatus } from '@k12/shared'

export type { Assignment, Courseware, FileSummary, Submission, SubmissionStatus, UserSummary } from '@k12/shared'

export type SubmissionViewStatus = SubmissionStatus | 'NOT_SUBMITTED'

export type StudentPage =
  | 'login'
  | 'home'
  | 'courseware'
  | 'assignments'
  | 'assignmentDetail'
  | 'submission'
  | 'result'
