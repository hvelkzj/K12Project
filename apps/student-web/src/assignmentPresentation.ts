import type { Assignment, Submission, SubmissionViewStatus } from './types'

export interface AssignmentListRow {
  assignment: Assignment
  status: SubmissionViewStatus
  latestSubmission?: Submission
}

export interface AssignmentProgress {
  percent: number
  text: string
}

const millisecondsPerHour = 60 * 60 * 1000
const millisecondsPerDay = 24 * millisecondsPerHour

const statusLabels: Record<SubmissionViewStatus, string> = {
  NOT_SUBMITTED: '未提交',
  SUBMITTED: '已提交',
  GRADED: '已批改',
  REVISION_REQUIRED: '需订正',
}

const statusProgress: Record<SubmissionViewStatus, AssignmentProgress> = {
  NOT_SUBMITTED: { percent: 0, text: '0/1 未完成' },
  SUBMITTED: { percent: 75, text: '已提交，待批改' },
  GRADED: { percent: 100, text: '1/1 已批改' },
  REVISION_REQUIRED: { percent: 50, text: '待订正' },
}

export function calculateGlobalProgress(
  statuses: readonly SubmissionViewStatus[],
): number {
  if (statuses.length === 0) return 0

  const completed = statuses.filter(
    (status) => status === 'SUBMITTED' || status === 'GRADED',
  ).length

  return Math.round((completed / statuses.length) * 100)
}

export function formatCountdown(dueAt: string, now: string): string {
  const remaining = new Date(dueAt).getTime() - new Date(now).getTime()

  if (!Number.isFinite(remaining)) return '时间待确认'
  if (remaining <= 0) return '已截止'

  if (remaining >= millisecondsPerDay) {
    return `剩余 ${Math.ceil(remaining / millisecondsPerDay)} 天`
  }

  return `剩余 ${Math.max(1, Math.ceil(remaining / millisecondsPerHour))} 小时`
}

export function getAssignmentProgress(
  status: SubmissionViewStatus,
): AssignmentProgress {
  return statusProgress[status]
}

export function getAssignmentActionLabel(
  status: SubmissionViewStatus,
  submissionClosed = false,
): string {
  if (
    submissionClosed &&
    (status === 'NOT_SUBMITTED' || status === 'REVISION_REQUIRED')
  ) {
    return '查看详情'
  }

  if (status === 'NOT_SUBMITTED') return '去提交'
  if (status === 'REVISION_REQUIRED') return '去订正'
  return '看结果'
}

export function isAssignmentSubmissionClosed(
  assignment: Assignment,
  now: string,
): boolean {
  return (
    !assignment.allowLate &&
    new Date(now).getTime() > new Date(assignment.dueAt).getTime()
  )
}

export function getSubmissionStatusLabel(
  status: SubmissionViewStatus,
): string {
  return statusLabels[status]
}

export function getScoreGrade(score?: number): string | undefined {
  if (score === undefined) return undefined
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}
