import type {
  Assignment,
  Courseware,
  FileSummary,
  Submission,
} from '@k12/shared'

import { studentBusinessClient } from './studentBusinessClient'
import type {
  StudentBusinessClient,
  StudentOverview,
  SubmitWorkInput,
} from './studentBusinessClient'
import type { SubmissionViewStatus } from './types'

export const maximumAttachmentBytes = 10 * 1024 * 1024

const allowedAttachmentTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])

const attachmentMimeTypeByExtension: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export function normalizeAttachmentMimeType(
  originalName: string,
  browserMimeType: string,
): string {
  const normalizedBrowserType = browserMimeType.trim().toLowerCase()
  const aliasedBrowserType =
    normalizedBrowserType === 'image/jpg'
      ? 'image/jpeg'
      : normalizedBrowserType

  if (allowedAttachmentTypes.has(aliasedBrowserType)) {
    return aliasedBrowserType
  }

  if (
    aliasedBrowserType &&
    aliasedBrowserType !== 'application/octet-stream'
  ) {
    return aliasedBrowserType
  }

  const extensionIndex = originalName.lastIndexOf('.')
  const extension =
    extensionIndex >= 0 ? originalName.slice(extensionIndex).toLowerCase() : ''
  return attachmentMimeTypeByExtension[extension] ?? 'application/octet-stream'
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

export function validateSubmissionInput(input: {
  content: string
  attachments: FileSummary[]
}): void {
  if (!input.content.trim() && input.attachments.length === 0) {
    throw new Error('作业正文和附件不能同时为空')
  }

  validateAttachments(input.attachments)
}

export function listCourseware(overview: StudentOverview): Courseware[] {
  return overview.courseware
}

export function listAssignments(overview: StudentOverview): Assignment[] {
  return overview.assignments
}

export function getAssignment(
  overview: StudentOverview,
  assignmentId: number,
): Assignment {
  const assignment = listAssignments(overview).find(
    (item) => item.id === assignmentId,
  )

  if (!assignment) {
    throw new Error('作业不存在或不属于当前班级')
  }

  return assignment
}

export function getSubmissionHistory(
  overview: StudentOverview,
  assignmentId: number,
): Submission[] {
  return overview.submissions
    .filter((submission) => submission.assignmentId === assignmentId)
    .sort((left, right) => left.attempt - right.attempt)
}

export function getLatestSubmission(
  overview: StudentOverview,
  assignmentId: number,
): Submission | undefined {
  return getSubmissionHistory(overview, assignmentId).at(-1)
}

export function selectDisplayedSubmission(
  submitted: Submission | null,
  overviewLatest: Submission | undefined,
): Submission | null {
  if (!submitted) return overviewLatest ?? null
  if (!overviewLatest) return submitted

  return overviewLatest.attempt >= submitted.attempt
    ? overviewLatest
    : submitted
}

export function applySubmissionToOverview(
  overview: StudentOverview,
  submission: Submission,
): StudentOverview {
  const submissions = overview.submissions.filter(
    (item) => item.id !== submission.id,
  )

  return {
    ...overview,
    submissions: [...submissions, submission],
  }
}

export function getSubmissionViewStatus(
  overview: StudentOverview,
  assignmentId: number,
): SubmissionViewStatus {
  return getLatestSubmission(overview, assignmentId)?.status ?? 'NOT_SUBMITTED'
}

export interface StudentDataService {
  loadOverview(): Promise<StudentOverview>
  submitWork(input: SubmitWorkInput): Promise<Submission>
}

export function createStudentDataService(
  client: StudentBusinessClient = studentBusinessClient,
): StudentDataService {
  return {
    loadOverview() {
      return client.getOverview()
    },

    async submitWork(input) {
      validateSubmissionInput(input)
      return client.submitWork(input)
    },
  }
}

export const studentDataService = createStudentDataService()
