import {
  assignments,
  coursewareMaterials,
  initialSubmissions,
  mockCredentials,
  mockNow,
  studentUser,
} from './mockData'
import type {
  Assignment,
  CoursewareMaterial,
  FileSummary,
  StudentUser,
  Submission,
  SubmissionViewStatus,
} from './types'

export const maximumAttachmentBytes = 10 * 1024 * 1024

const allowedAttachmentTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])

let submissions = cloneSubmissions(initialSubmissions)

function cloneSubmissions(items: Submission[]): Submission[] {
  return items.map((item) => ({
    ...item,
    attachments: item.attachments.map((attachment) => ({ ...attachment })),
  }))
}

function ensureCurrentStudent(studentId: number): void {
  if (studentId !== studentUser.id) {
    throw new Error('学生只能查看和提交自己的作业')
  }
}

export function authenticateStudent(
  account: string,
  password: string,
): StudentUser {
  if (
    account.trim() !== mockCredentials.account ||
    password !== mockCredentials.password
  ) {
    throw new Error('账号或密码错误')
  }

  return { ...studentUser }
}

export function listCourseware(studentId: number): CoursewareMaterial[] {
  ensureCurrentStudent(studentId)
  return coursewareMaterials.map((material) => ({
    ...material,
    file: { ...material.file },
  }))
}

export function listAssignments(studentId: number): Assignment[] {
  ensureCurrentStudent(studentId)
  return assignments
    .filter((assignment) => assignment.classId === studentUser.classId)
    .map((assignment) => ({
      ...assignment,
      attachments: assignment.attachments.map((attachment) => ({
        ...attachment,
      })),
    }))
}

export function getAssignment(
  assignmentId: number,
  studentId: number,
): Assignment {
  const assignment = listAssignments(studentId).find(
    (item) => item.id === assignmentId,
  )

  if (!assignment) {
    throw new Error('作业不存在或不属于当前班级')
  }

  return assignment
}

export function getSubmissionHistory(
  assignmentId: number,
  studentId: number,
): Submission[] {
  ensureCurrentStudent(studentId)
  return cloneSubmissions(
    submissions
      .filter(
        (submission) =>
          submission.assignmentId === assignmentId &&
          submission.studentId === studentId,
      )
      .sort((left, right) => left.attempt - right.attempt),
  )
}

export function getLatestSubmission(
  assignmentId: number,
  studentId: number,
): Submission | undefined {
  return getSubmissionHistory(assignmentId, studentId).at(-1)
}

export function getSubmissionViewStatus(
  assignmentId: number,
  studentId: number,
): SubmissionViewStatus {
  return getLatestSubmission(assignmentId, studentId)?.status ?? 'NOT_SUBMITTED'
}

export function validateAttachments(attachments: FileSummary[]): void {
  for (const attachment of attachments) {
    if (!allowedAttachmentTypes.has(attachment.mimeType)) {
      throw new Error('附件仅支持 PDF、DOCX、JPG 或 PNG')
    }

    if (attachment.byteSize > maximumAttachmentBytes) {
      throw new Error('单个附件不能超过 10 MB')
    }
  }
}

export function submitAssignment(input: {
  assignmentId: number
  studentId: number
  content: string
  attachments: FileSummary[]
  submittedAt?: string
}): Submission {
  const assignment = getAssignment(input.assignmentId, input.studentId)
  const latestSubmission = getLatestSubmission(input.assignmentId, input.studentId)
  const submittedAt = input.submittedAt ?? mockNow

  if (!input.content.trim() && input.attachments.length === 0) {
    throw new Error('作业正文和附件不能同时为空')
  }

  if (
    !assignment.allowLate &&
    new Date(submittedAt).getTime() > new Date(assignment.dueAt).getTime()
  ) {
    throw new Error('作业已截止，不能继续提交')
  }

  if (
    latestSubmission &&
    latestSubmission.status !== 'REVISION_REQUIRED'
  ) {
    throw new Error('当前作业已提交，不能重复提交')
  }

  validateAttachments(input.attachments)

  const nextId = Math.max(0, ...submissions.map((submission) => submission.id)) + 1
  const nextAttempt = (latestSubmission?.attempt ?? 0) + 1
  const submission: Submission = {
    id: nextId,
    assignmentId: assignment.id,
    studentId: input.studentId,
    attempt: nextAttempt,
    content: input.content.trim(),
    attachments: input.attachments.map((attachment) => ({ ...attachment })),
    status: 'SUBMITTED',
    submittedAt,
    teacherComment: '',
    updatedAt: submittedAt,
  }

  submissions.push(submission)
  return cloneSubmissions([submission])[0] as Submission
}

export function resetMockSubmissions(): void {
  submissions = cloneSubmissions(initialSubmissions)
}
