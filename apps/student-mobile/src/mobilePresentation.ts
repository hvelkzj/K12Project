import type {
  Assignment,
  AttendanceRecord,
  AttendanceStatus,
  Courseware,
  StudentOverview,
  Submission,
  SubmissionStatus,
} from '@k12/shared'

export type MobileAssignmentStatus = SubmissionStatus | 'NOT_SUBMITTED'

export interface AssignmentRow {
  assignment: Assignment
  status: MobileAssignmentStatus
  latestSubmission: Submission | null
}

export function latestSubmission(
  submissions: readonly Submission[],
  assignmentId: number,
): Submission | null {
  return (
    submissions
      .filter((item) => item.assignmentId === assignmentId)
      .sort((left, right) => right.attempt - left.attempt)[0] ?? null
  )
}

export function assignmentRows(overview: StudentOverview): AssignmentRow[] {
  return overview.assignments
    .map((assignment) => {
      const submission = latestSubmission(overview.submissions, assignment.id)
      return {
        assignment,
        latestSubmission: submission,
        status: (submission?.status ?? 'NOT_SUBMITTED') as MobileAssignmentStatus,
      }
    })
    .sort(
      (left, right) =>
        Date.parse(left.assignment.dueAt) - Date.parse(right.assignment.dueAt),
    )
}

export function assignmentStatusLabel(status: MobileAssignmentStatus): string {
  const labels: Record<MobileAssignmentStatus, string> = {
    NOT_SUBMITTED: '待提交',
    SUBMITTED: '已提交',
    GRADED: '已批改',
    REVISION_REQUIRED: '待订正',
  }
  return labels[status]
}

export function attendanceStatusLabel(status: AttendanceStatus): string {
  const labels: Record<AttendanceStatus, string> = {
    PRESENT: '已出勤',
    LATE: '迟到',
    ABSENT: '缺勤',
    LEAVE: '请假',
  }
  return labels[status]
}

export function attendanceSummary(records: readonly AttendanceRecord[]) {
  const counts: Record<AttendanceStatus, number> = {
    PRESENT: 0,
    LATE: 0,
    ABSENT: 0,
    LEAVE: 0,
  }
  for (const record of records) counts[record.status] += 1
  return counts
}

export function filterCourseware(
  materials: readonly Courseware[],
  query: string,
): Courseware[] {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  if (!normalized) return [...materials]
  return materials.filter((item) =>
    `${item.title} ${item.description}`
      .toLocaleLowerCase('zh-CN')
      .includes(normalized),
  )
}

export function validateAttachment(
  name: string,
  mimeType: string,
  byteSize: number,
): string | null {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? ''
  const allowedExtensions = new Set(['pdf', 'docx', 'jpg', 'jpeg', 'png'])
  const allowedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ])
  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(mimeType)) {
    return '附件仅支持 PDF、DOCX、JPG 或 PNG'
  }
  if (byteSize <= 0) return '附件内容不能为空'
  if (byteSize > 10 * 1024 * 1024) return '单个附件不能超过 10 MB'
  return null
}
