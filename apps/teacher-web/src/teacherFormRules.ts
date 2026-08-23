import type { ScheduleSummary } from '@k12/shared'

import type {
  AssignmentInput,
  FeedbackInput,
  GradeInput,
  ScheduleChangeInput,
} from './teacherBusinessClient'

export function resetScheduleScopedDrafts(drafts: {
  assignment: {
    title: string
    description: string
    dueAt: string
    allowLate: boolean
  }
  feedback: {
    performance: string
    strengths: string
    improvements: string
    suggestion: string
  }
  scheduleChange: {
    proposedDate: string
    proposedStartTime: string
    proposedEndTime: string
    reason: string
  }
}): void {
  drafts.assignment.title = ''
  drafts.assignment.description = ''
  drafts.assignment.dueAt = ''
  drafts.assignment.allowLate = false
  drafts.feedback.performance = ''
  drafts.feedback.strengths = ''
  drafts.feedback.improvements = ''
  drafts.feedback.suggestion = ''
  drafts.scheduleChange.proposedDate = ''
  drafts.scheduleChange.proposedStartTime = ''
  drafts.scheduleChange.proposedEndTime = ''
  drafts.scheduleChange.reason = ''
}

export function assignmentInput(
  schedule: ScheduleSummary,
  draft: {
    title: string
    description: string
    dueAt: string
    allowLate: boolean
  },
): AssignmentInput {
  const title = draft.title.trim()
  const description = draft.description.trim()
  if (!title || !description) throw new Error('作业标题和内容不能为空')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.dueAt)) {
    throw new Error('请选择有效的作业截止时间')
  }

  return {
    classId: schedule.classId,
    courseId: schedule.courseId,
    scheduleId: schedule.id,
    title,
    description,
    attachments: [],
    dueAt: `${draft.dueAt}:00+08:00`,
    allowLate: draft.allowLate,
  }
}

export function gradeInput(draft: {
  score: number | null
  teacherComment: string
  correctionRequired: boolean
}): GradeInput {
  if (
    draft.score === null ||
    !Number.isFinite(draft.score) ||
    draft.score < 0 ||
    draft.score > 100
  ) {
    throw new Error('分数必须在 0 到 100 之间')
  }
  return {
    score: draft.score,
    teacherComment: draft.teacherComment.trim(),
    correctionRequired: draft.correctionRequired,
  }
}

export function feedbackInput(
  scheduleId: number,
  draft: {
    studentId: number
    performance: string
    strengths: string
    improvements: string
    suggestion: string
  },
): FeedbackInput {
  if (!Number.isInteger(draft.studentId) || draft.studentId <= 0) {
    throw new Error('请选择反馈学生')
  }
  const performance = draft.performance.trim()
  const strengths = draft.strengths.trim()
  const improvements = draft.improvements.trim()
  const suggestion = draft.suggestion.trim()
  if (!performance || !strengths || !improvements || !suggestion) {
    throw new Error('课后反馈字段不能为空')
  }
  return {
    scheduleId,
    studentId: draft.studentId,
    performance,
    strengths,
    improvements,
    suggestion,
  }
}

export function scheduleChangeInput(
  scheduleId: number,
  draft: {
    proposedDate: string
    proposedStartTime: string
    proposedEndTime: string
    reason: string
  },
): ScheduleChangeInput {
  const reason = draft.reason.trim()
  if (!reason) throw new Error('调课原因不能为空')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.proposedDate)) {
    throw new Error('请选择有效的调课日期')
  }
  if (
    !/^\d{2}:\d{2}$/.test(draft.proposedStartTime) ||
    !/^\d{2}:\d{2}$/.test(draft.proposedEndTime) ||
    draft.proposedStartTime >= draft.proposedEndTime
  ) {
    throw new Error('调课开始时间必须早于结束时间')
  }
  return {
    scheduleId,
    reason,
    proposedDate: draft.proposedDate,
    proposedStartTime: `${draft.proposedStartTime}:00`,
    proposedEndTime: `${draft.proposedEndTime}:00`,
  }
}
