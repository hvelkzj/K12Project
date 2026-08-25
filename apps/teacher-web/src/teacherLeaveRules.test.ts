import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  AttendanceRecord,
  LeaveRequest,
  ScheduleSummary,
} from '@k12/shared'

import {
  assertApprovedLeavesUseLeave,
  assertScheduleActive,
  buildAttendanceDrafts,
  leaveBadgeText,
  saveAttendanceAndApply,
  visibleLeaveForStudent,
} from './teacherLeaveRules'

const schedule: ScheduleSummary = {
  id: 1001,
  campusId: 1,
  classId: 101,
  courseId: 11,
  teacherId: 301,
  lessonDate: '2026-08-21',
  startTime: '09:00:00',
  endTime: '10:30:00',
  room: 'A-302',
  status: 'SCHEDULED',
}

function leave(
  id: number,
  studentId: number,
  status: LeaveRequest['status'],
  scheduleId = schedule.id,
): LeaveRequest {
  return {
    id,
    parentId: 201,
    studentId,
    scheduleId,
    reason: '身体不适',
    contactPhone: '13800000001',
    status,
    reviewedBy: status === 'PENDING' ? null : 901,
    reviewNote: status === 'REJECTED' ? '材料不足' : '',
    reviewedAt: status === 'PENDING' ? null : '2026-08-21T01:30:00.000Z',
    createdAt: '2026-08-21T01:00:00.000Z',
    updatedAt: '2026-08-21T01:30:00.000Z',
  }
}

const leaveRequests = [
  leave(9001, 101, 'APPROVED'),
  leave(9002, 102, 'PENDING'),
  leave(9003, 103, 'REJECTED'),
  leave(9004, 104, 'APPROVED', 1002),
]

test('批准请假默认 LEAVE，待审批只提醒，拒绝不影响签到', () => {
  const drafts = buildAttendanceDrafts({
    students: [{ id: 101 }, { id: 102 }, { id: 103 }, { id: 104 }],
    scheduleId: schedule.id,
    attendance: [],
    leaveRequests,
  })

  assert.deepEqual(
    drafts.map((item) => item.status),
    ['LEAVE', 'PRESENT', 'PRESENT', 'PRESENT'],
  )
  assert.equal(
    leaveBadgeText(visibleLeaveForStudent(leaveRequests, 1001, 101)!),
    '已批准请假',
  )
  assert.equal(
    leaveBadgeText(visibleLeaveForStudent(leaveRequests, 1001, 102)!),
    '请假待审批',
  )
  assert.equal(visibleLeaveForStudent(leaveRequests, 1001, 103), undefined)
  assert.equal(visibleLeaveForStudent(leaveRequests, 1001, 104), undefined)
})

test('已有签到保留，但批准请假不能被改成其他状态', () => {
  const attendance: AttendanceRecord[] = [
    {
      id: 10001,
      scheduleId: 1001,
      studentId: 102,
      status: 'LATE',
      note: '迟到',
      recordedBy: 301,
      recordedAt: '2026-08-21T01:05:00.000Z',
    },
  ]
  const drafts = buildAttendanceDrafts({
    students: [{ id: 101 }, { id: 102 }],
    scheduleId: schedule.id,
    attendance,
    leaveRequests,
  })
  assert.deepEqual(
    drafts.map((item) => item.status),
    ['LEAVE', 'LATE'],
  )
  assert.throws(
    () =>
      assertApprovedLeavesUseLeave({
        drafts: [{ studentId: 101, status: 'PRESENT', note: '' }],
        leaveRequests,
        scheduleId: schedule.id,
      }),
    /只能登记为“请假”/,
  )
})

test('取消课次在函数入口阻止写操作', () => {
  assert.doesNotThrow(() => assertScheduleActive(schedule))
  assert.throws(
    () => assertScheduleActive({ ...schedule, status: 'CANCELLED' }),
    /已取消课次/,
  )
})

test('签到请求失败时不修改页面状态，成功后才应用结果', async () => {
  const state: AttendanceRecord[] = []
  await assert.rejects(
    saveAttendanceAndApply({
      save: async () => {
        throw new Error('NETWORK_ERROR')
      },
      apply: (created) => state.push(...created),
    }),
    /NETWORK_ERROR/,
  )
  assert.equal(state.length, 0)

  const created: AttendanceRecord[] = [
    {
      id: 10001,
      scheduleId: 1001,
      studentId: 101,
      status: 'LEAVE',
      note: '',
      recordedBy: 301,
      recordedAt: '2026-08-21T01:05:00.000Z',
    },
  ]
  await saveAttendanceAndApply({
    save: async () => created,
    apply: (records) => state.push(...records),
  })
  assert.deepEqual(state, created)
})
