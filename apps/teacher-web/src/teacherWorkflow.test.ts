import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  AttendanceRecord,
  ScheduleChange,
  ScheduleSummary,
} from '@k12/shared'

import {
  canUseHomeroomScope,
  canWriteSchedule,
  visibleSchedulesForTeacher,
  type TeacherUser,
} from './teacherAccess'
import {
  createAttendanceRecords,
  createScheduleChange,
} from './teacherWorkflow'

const teacher: TeacherUser = {
  id: 301,
  displayName: '李老师',
  role: 'TEACHER',
  campusId: 1,
}
const homeroomTeacher: TeacherUser = {
  id: 302,
  displayName: '周老师',
  role: 'HOMEROOM_TEACHER',
  campusId: 1,
}
const ownSchedule: ScheduleSummary = {
  id: 1001,
  campusId: 1,
  classId: 101,
  courseId: 11,
  teacherId: 301,
  lessonDate: '2026-08-19',
  startTime: '09:00:00',
  endTime: '10:30:00',
  room: 'A-302',
  status: 'SCHEDULED',
}
const homeroomOwnSchedule: ScheduleSummary = {
  ...ownSchedule,
  id: 1003,
  teacherId: 302,
  courseId: 12,
}
const otherSchedule: ScheduleSummary = {
  ...ownSchedule,
  id: 1002,
  classId: 102,
  teacherId: 303,
}

test('任课教师只能查看本人授课课次', () => {
  const visible = visibleSchedulesForTeacher(
    teacher,
    [ownSchedule, homeroomOwnSchedule, otherSchedule],
    [101],
  )
  assert.deepEqual(visible.map((item) => item.id), [1001])
  assert.equal(canUseHomeroomScope(teacher), false)
})

test('班主任可查看负责班级，但只能写本人授课课次', () => {
  const visible = visibleSchedulesForTeacher(
    homeroomTeacher,
    [ownSchedule, homeroomOwnSchedule, otherSchedule],
    [101],
  )
  assert.deepEqual(visible.map((item) => item.id), [1003, 1001])
  assert.equal(canUseHomeroomScope(homeroomTeacher), true)
  assert.equal(canWriteSchedule(homeroomTeacher, homeroomOwnSchedule), true)
  assert.equal(canWriteSchedule(homeroomTeacher, ownSchedule), false)
})

test('签到使用数字 ID、公共状态和带时区时间', () => {
  const records = createAttendanceRecords({
    user: teacher,
    schedule: ownSchedule,
    drafts: [
      { studentId: 101, status: 'PRESENT', note: '' },
      { studentId: 104, status: 'LATE', note: '迟到 5 分钟' },
    ],
    existing: [],
    recordedAt: '2026-08-19T09:05:00+08:00',
  })

  assert.deepEqual(records.map((item) => item.studentId), [101, 104])
  assert.deepEqual(records.map((item) => item.status), ['PRESENT', 'LATE'])
  assert.equal(records[0]?.recordedBy, 301)
})

test('同一学生不能重复签到', () => {
  const existing: AttendanceRecord[] = [
    {
      id: 1,
      scheduleId: 1001,
      studentId: 101,
      status: 'PRESENT',
      note: '',
      recordedBy: 301,
      recordedAt: '2026-08-19T09:05:00+08:00',
    },
  ]

  assert.throws(
    () =>
      createAttendanceRecords({
        user: teacher,
        schedule: ownSchedule,
        drafts: [{ studentId: 101, status: 'LATE', note: '' }],
        existing,
        recordedAt: '2026-08-19T09:10:00+08:00',
      }),
    /不能重复签到/,
  )
  assert.throws(
    () =>
      createAttendanceRecords({
        user: teacher,
        schedule: ownSchedule,
        drafts: [
          { studentId: 104, status: 'PRESENT', note: '' },
          { studentId: 104, status: 'LATE', note: '' },
        ],
        existing: [],
        recordedAt: '2026-08-19T09:10:00+08:00',
      }),
    /不能重复签到/,
  )
})

test('调课申请保留数字关联、公共状态和 ISO 时间', () => {
  const request = createScheduleChange({
    user: teacher,
    schedule: ownSchedule,
    draft: {
      proposedDate: '2026-08-22',
      proposedStartTime: '10:00',
      proposedEndTime: '11:30',
      reason: '参加学校教研活动',
    },
    existing: [],
    createdAt: '2026-08-19T10:00:00+08:00',
  })

  assert.equal(request.scheduleId, 1001)
  assert.equal(request.requestedBy, 301)
  assert.equal(request.status, 'PENDING')
  assert.equal(request.createdAt, '2026-08-19T10:00:00+08:00')
  assert.equal(request.proposedStartTime, '10:00:00')
})

test('调课校验本人授课、时间、原因和重复状态', () => {
  const validDraft = {
    proposedDate: '2026-08-22',
    proposedStartTime: '10:00',
    proposedEndTime: '11:30',
    reason: '参加学校教研活动',
  }
  const existing: ScheduleChange[] = [
    createScheduleChange({
      user: teacher,
      schedule: ownSchedule,
      draft: validDraft,
      existing: [],
      createdAt: '2026-08-19T10:00:00Z',
    }),
  ]

  assert.throws(
    () =>
      createScheduleChange({
        user: teacher,
        schedule: ownSchedule,
        draft: validDraft,
        existing,
        createdAt: '2026-08-19T10:05:00Z',
      }),
    /已有处理中或已处理/,
  )
  assert.throws(
    () =>
      createScheduleChange({
        user: teacher,
        schedule: ownSchedule,
        draft: { ...validDraft, proposedEndTime: '09:30' },
        existing: [],
        createdAt: '2026-08-19T10:05:00Z',
      }),
    /开始时间必须早于结束时间/,
  )
  assert.throws(
    () =>
      createScheduleChange({
        user: homeroomTeacher,
        schedule: ownSchedule,
        draft: validDraft,
        existing: [],
        createdAt: '2026-08-19T10:05:00Z',
      }),
    /只能操作本人授课课次/,
  )
})
