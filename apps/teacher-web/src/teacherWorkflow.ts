import type {
  AttendanceRecord,
  AttendanceStatus,
  ScheduleChange,
  ScheduleSummary,
} from '@k12/shared'

import { canWriteSchedule, type TeacherUser } from './teacherAccess'

export interface AttendanceDraft {
  studentId: number
  status: AttendanceStatus
  note: string
}

export interface ScheduleChangeDraft {
  proposedDate: string
  proposedStartTime: string
  proposedEndTime: string
  reason: string
}

function assertTeachingWrite(
  user: TeacherUser,
  schedule: ScheduleSummary,
): void {
  if (!canWriteSchedule(user, schedule)) {
    throw new Error('只能操作本人授课课次')
  }
}

function isIsoTimestampWithZone(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value,
  )
}

export function createAttendanceRecords(input: {
  user: TeacherUser
  schedule: ScheduleSummary
  drafts: readonly AttendanceDraft[]
  existing: readonly AttendanceRecord[]
  recordedAt: string
}): AttendanceRecord[] {
  assertTeachingWrite(input.user, input.schedule)
  if (!isIsoTimestampWithZone(input.recordedAt)) {
    throw new Error('签到时间必须是带时区的 ISO 8601 字符串')
  }

  const draftStudentIds = input.drafts.map((item) => item.studentId)
  if (new Set(draftStudentIds).size !== draftStudentIds.length) {
    throw new Error('同一学生不能重复签到')
  }
  if (
    input.existing.some(
      (record) =>
        record.scheduleId === input.schedule.id &&
        draftStudentIds.includes(record.studentId),
    )
  ) {
    throw new Error('同一学生不能重复签到')
  }

  const firstId = Math.max(0, ...input.existing.map((item) => item.id)) + 1
  return input.drafts.map((draft, index) => ({
    id: firstId + index,
    scheduleId: input.schedule.id,
    studentId: draft.studentId,
    status: draft.status,
    note: draft.note.trim(),
    recordedBy: input.user.id,
    recordedAt: input.recordedAt,
  }))
}

export function createScheduleChange(input: {
  user: TeacherUser
  schedule: ScheduleSummary
  draft: ScheduleChangeDraft
  existing: readonly ScheduleChange[]
  createdAt: string
}): ScheduleChange {
  assertTeachingWrite(input.user, input.schedule)
  if (!input.draft.reason.trim()) throw new Error('调课原因不能为空')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.draft.proposedDate)) {
    throw new Error('调课日期格式不正确')
  }
  if (
    !/^\d{2}:\d{2}$/.test(input.draft.proposedStartTime) ||
    !/^\d{2}:\d{2}$/.test(input.draft.proposedEndTime) ||
    input.draft.proposedStartTime >= input.draft.proposedEndTime
  ) {
    throw new Error('调课开始时间必须早于结束时间')
  }
  if (!isIsoTimestampWithZone(input.createdAt)) {
    throw new Error('提交时间必须是带时区的 ISO 8601 字符串')
  }
  if (
    input.existing.some(
      (item) =>
        item.scheduleId === input.schedule.id && item.status !== 'REJECTED',
    )
  ) {
    throw new Error('该课次已有处理中或已处理的调课申请')
  }

  return {
    id: Math.max(0, ...input.existing.map((item) => item.id)) + 1,
    campusId: input.schedule.campusId,
    scheduleId: input.schedule.id,
    requestedBy: input.user.id,
    reason: input.draft.reason.trim(),
    originalTeacherId: input.schedule.teacherId,
    originalDate: input.schedule.lessonDate,
    originalStartTime: input.schedule.startTime,
    originalEndTime: input.schedule.endTime,
    proposedDate: input.draft.proposedDate,
    proposedStartTime: `${input.draft.proposedStartTime}:00`,
    proposedEndTime: `${input.draft.proposedEndTime}:00`,
    status: 'PENDING',
    decisionNote: '',
    reviewedBy: null,
    reviewedAt: null,
    substituteTeacherId: null,
    substituteNote: '',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }
}
