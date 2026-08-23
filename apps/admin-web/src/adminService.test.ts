import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignSubstitute,
  availableSubstituteTeachers,
  closeWorkOrder,
  ensureCampusAccess,
  filterByScope,
  reviewScheduleChange,
  startWorkOrder,
} from './adminService'
import { isAdminRole } from './authService'
import type {
  FeedbackWorkOrder,
  Schedule,
  ScheduleChange,
  UserAccount,
} from './types'

const schedules: Schedule[] = [
  {
    id: 1001,
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    lessonDate: '2026-08-18',
    startTime: '09:00:00',
    endTime: '10:30:00',
    room: 'A-302',
    status: 'SCHEDULED',
  },
  {
    id: 1002,
    campusId: 1,
    classId: 102,
    courseId: 12,
    teacherId: 303,
    lessonDate: '2026-08-18',
    startTime: '14:00:00',
    endTime: '15:30:00',
    room: 'B-205',
    status: 'SCHEDULED',
  },
  {
    id: 2001,
    campusId: 2,
    classId: 201,
    courseId: 13,
    teacherId: 401,
    lessonDate: '2026-08-18',
    startTime: '10:00:00',
    endTime: '11:30:00',
    room: 'C-101',
    status: 'SCHEDULED',
  },
]

const scheduleChanges: ScheduleChange[] = [
  {
    id: 7001,
    campusId: 1,
    scheduleId: 1001,
    requestedBy: 301,
    reason: '参加教研活动',
    originalTeacherId: 301,
    originalDate: '2026-08-18',
    originalStartTime: '09:00:00',
    originalEndTime: '10:30:00',
    proposedDate: '2026-08-19',
    proposedStartTime: '16:00:00',
    proposedEndTime: '17:30:00',
    status: 'PENDING',
    decisionNote: '',
    substituteNote: '',
    createdAt: '2026-08-17T09:20:00+08:00',
    updatedAt: '2026-08-17T09:20:00+08:00',
  },
  {
    id: 7002,
    campusId: 1,
    scheduleId: 1002,
    requestedBy: 303,
    reason: '参加培训',
    originalTeacherId: 303,
    originalDate: '2026-08-18',
    originalStartTime: '14:00:00',
    originalEndTime: '15:30:00',
    proposedDate: '2026-08-18',
    proposedStartTime: '14:00:00',
    proposedEndTime: '15:30:00',
    status: 'APPROVED',
    decisionNote: '时间不变，安排同校区教师代课',
    reviewedBy: 901,
    reviewedAt: '2026-08-17T10:10:00+08:00',
    substituteNote: '',
    createdAt: '2026-08-17T08:40:00+08:00',
    updatedAt: '2026-08-17T10:10:00+08:00',
  },
]

const workOrders: FeedbackWorkOrder[] = [
  {
    id: 6001,
    feedbackId: 501,
    campusId: 1,
    issue: '家长认为缺勤记录有误。',
    status: 'OPEN',
    result: '',
    createdAt: '2026-08-17T09:12:00+08:00',
    updatedAt: '2026-08-17T09:12:00+08:00',
  },
]

const users: UserAccount[] = [
  {
    id: 901,
    campusId: 1,
    displayName: '许教务',
    username: 'academic_901',
    role: 'ACADEMIC_ADMIN',
    active: true,
  },
  {
    id: 999,
    campusId: 1,
    displayName: '系统管理员',
    username: 'system_999',
    role: 'SYSTEM_ADMIN',
    active: true,
  },
]

const teachers = [
  { id: 301, campusId: 1, displayName: '李老师' },
  { id: 302, campusId: 1, displayName: '周老师' },
  { id: 303, campusId: 1, displayName: '王老师' },
  { id: 401, campusId: 2, displayName: '陈老师' },
  { id: 402, campusId: 2, displayName: '赵老师' },
]

function findScheduleChange(id: number) {
  const change = scheduleChanges.find((item) => item.id === id)
  assert.ok(change)
  return change
}

test('教务只能看到所属校区数据并拒绝跨校区访问', () => {
  const visible = filterByScope(schedules, 'ACADEMIC_ADMIN', 1)

  assert.deepEqual(visible.map((item) => item.campusId), [1, 1])
  assert.throws(
    () => ensureCampusAccess(2, 'ACADEMIC_ADMIN', 1),
    /教务只能访问所属校区的数据/,
  )
})

test('系统管理员可以查看全部校区数据', () => {
  const visible = filterByScope(schedules, 'SYSTEM_ADMIN', 1)

  assert.deepEqual(new Set(visible.map((item) => item.campusId)), new Set([1, 2]))
  assert.doesNotThrow(() => ensureCampusAccess(2, 'SYSTEM_ADMIN', 1))
})

test('两种管理员角色都可以进入后台，非管理员不能进入', () => {
  assert.equal(isAdminRole('ACADEMIC_ADMIN'), true)
  assert.equal(isAdminRole('SYSTEM_ADMIN'), true)
  assert.equal(isAdminRole('PARENT'), false)
  assert.equal(isAdminRole('STUDENT'), false)
  assert.equal(isAdminRole('TEACHER'), false)
  assert.equal(isAdminRole('HOMEROOM_TEACHER'), false)
  assert.equal(isAdminRole(undefined), false)
})

test('用户账号字段使用 username 和 active，不再使用 account 和 enabled', () => {
  const academic = users.find((user) => user.role === 'ACADEMIC_ADMIN')
  const admin = users.find((user) => user.role === 'SYSTEM_ADMIN')

  assert.ok(academic)
  assert.ok(admin)
  assert.equal(academic.username, 'academic_901')
  assert.equal(admin.username, 'system_999')
  assert.equal(academic.active, true)
  assert.equal(admin.active, true)
  assert.equal('account' in academic, false)
  assert.equal('enabled' in academic, false)
})

test('待审批调课申请可以通过', () => {
  const reviewed = reviewScheduleChange(
    findScheduleChange(7001),
    'APPROVED',
    '课程和教室无冲突',
    901,
    '2026-08-17T12:00:00+08:00',
  )

  assert.equal(reviewed.status, 'APPROVED')
  assert.equal(reviewed.reviewedBy, 901)
})

test('拒绝调课申请时必须填写原因', () => {
  assert.throws(
    () =>
      reviewScheduleChange(
        findScheduleChange(7001),
        'REJECTED',
        '   ',
        901,
        '2026-08-17T12:00:00+08:00',
      ),
    /拒绝调课时必须填写拒绝原因/,
  )
})

test('已经审批的申请不能重复审批', () => {
  assert.throws(
    () =>
      reviewScheduleChange(
        findScheduleChange(7002),
        'APPROVED',
        '',
        901,
        '2026-08-17T12:00:00+08:00',
      ),
    /该申请已审批，不能重复处理/,
  )
})

test('只有已通过的申请可以选择代课教师', () => {
  const assigned = assignSubstitute(
    findScheduleChange(7002),
    302,
    '已确认无课程冲突',
    '2026-08-17T12:10:00+08:00',
  )

  assert.equal(assigned.status, 'SUBSTITUTE_ASSIGNED')
  assert.equal(assigned.substituteTeacherId, 302)
  assert.throws(
    () =>
      assignSubstitute(
        findScheduleChange(7001),
        302,
        '',
        '2026-08-17T12:10:00+08:00',
      ),
    /只有已通过的调课申请可以安排代课/,
  )
})

test('代课教师只限申请所在校区且不能是原教师', () => {
  const campusOneChange = findScheduleChange(7002)

  const campusOneTeachers = availableSubstituteTeachers(campusOneChange, teachers)
  assert.ok(campusOneTeachers.every((teacher) => teacher.campusId === 1))
  assert.ok(campusOneTeachers.every((teacher) => teacher.id !== 303))
  assert.deepEqual(
    campusOneTeachers.map((teacher) => teacher.id).sort(),
    [301, 302],
  )

  const campusTwoChange = {
    ...findScheduleChange(7001),
    campusId: 2,
    originalTeacherId: 401,
  }
  const campusTwoTeachers = availableSubstituteTeachers(campusTwoChange, teachers)
  assert.deepEqual(
    campusTwoTeachers.map((teacher) => teacher.id).sort(),
    [402],
  )

  assert.deepEqual(availableSubstituteTeachers(undefined, teachers), [])
})

test('关闭反馈工单前必须填写处理结果', () => {
  assert.throws(
    () =>
      closeWorkOrder(
        workOrders[0] as FeedbackWorkOrder,
        '',
        901,
        '2026-08-17T12:20:00+08:00',
      ),
    /关闭工单前必须填写处理结果/,
  )

  const closed = closeWorkOrder(
    workOrders[0] as FeedbackWorkOrder,
    '已核对签到，教师已更正反馈。',
    901,
    '2026-08-17T12:20:00+08:00',
  )
  assert.equal(closed.status, 'CLOSED')
  assert.equal(closed.closedAt, '2026-08-17T12:20:00+08:00')
})

test('已关闭工单不能再次关闭', () => {
  const closed = closeWorkOrder(
    workOrders[0] as FeedbackWorkOrder,
    '已核对签到，教师已更正反馈。',
    901,
    '2026-08-17T12:20:00+08:00',
  )

  assert.throws(
    () =>
      closeWorkOrder(
        closed,
        '再次关闭',
        901,
        '2026-08-17T12:30:00+08:00',
      ),
    /该工单已经关闭/,
  )
})

test('已关闭工单不能重新开始处理', () => {
  const closed = closeWorkOrder(
    workOrders[0] as FeedbackWorkOrder,
    '已核对签到，教师已更正反馈。',
    901,
    '2026-08-17T12:20:00+08:00',
  )

  assert.throws(
    () => startWorkOrder(closed, 901, '2026-08-17T12:30:00+08:00'),
    /已关闭工单不能重新处理/,
  )
})
