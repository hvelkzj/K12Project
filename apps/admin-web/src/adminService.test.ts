import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assignSubstitute,
  availableSubstituteTeachers,
  closeWorkOrder,
  ensureCampusAccess,
  filterByScope,
  reviewScheduleChange,
} from './adminService'
import { isAdminRole } from './authService'
import {
  initialScheduleChanges,
  initialSchedules,
  initialUsers,
  initialWorkOrders,
  teachers,
} from './mockData'

function findScheduleChange(id: number) {
  const change = initialScheduleChanges.find((item) => item.id === id)
  assert.ok(change)
  return change
}

function findWorkOrder(id: number) {
  const workOrder = initialWorkOrders.find((item) => item.id === id)
  assert.ok(workOrder)
  return workOrder
}

test('教务只能看到所属校区数据并拒绝跨校区访问', () => {
  const visible = filterByScope(initialSchedules, 'ACADEMIC_ADMIN', 1)

  assert.deepEqual(visible.map((item) => item.campusId), [1, 1])
  assert.throws(
    () => ensureCampusAccess(2, 'ACADEMIC_ADMIN', 1),
    /教务只能访问所属校区的数据/,
  )
})

test('系统管理员可以查看全部校区数据', () => {
  const visible = filterByScope(initialSchedules, 'SYSTEM_ADMIN', 1)

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
  const academic = initialUsers.find((user) => user.role === 'ACADEMIC_ADMIN')
  const admin = initialUsers.find((user) => user.role === 'SYSTEM_ADMIN')

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
    findScheduleChange(3001),
    'APPROVED',
    '课程和教室无冲突',
    901,
    '2026-08-07T12:00:00+08:00',
  )

  assert.equal(reviewed.status, 'APPROVED')
  assert.equal(reviewed.reviewedBy, 901)
})

test('拒绝调课申请时必须填写原因', () => {
  assert.throws(
    () =>
      reviewScheduleChange(
        findScheduleChange(3001),
        'REJECTED',
        '   ',
        901,
        '2026-08-07T12:00:00+08:00',
      ),
    /拒绝调课时必须填写拒绝原因/,
  )
})

test('已经审批的申请不能重复审批', () => {
  assert.throws(
    () =>
      reviewScheduleChange(
        findScheduleChange(3002),
        'APPROVED',
        '',
        901,
        '2026-08-07T12:00:00+08:00',
      ),
    /该申请已审批，不能重复处理/,
  )
})

test('只有已通过的申请可以选择代课教师', () => {
  const assigned = assignSubstitute(
    findScheduleChange(3002),
    302,
    '已确认无课程冲突',
    '2026-08-07T12:10:00+08:00',
  )

  assert.equal(assigned.status, 'SUBSTITUTE_ASSIGNED')
  assert.equal(assigned.substituteTeacherId, 302)
  assert.throws(
    () =>
      assignSubstitute(
        findScheduleChange(3001),
        302,
        '',
        '2026-08-07T12:10:00+08:00',
      ),
    /只有已通过的调课申请可以安排代课/,
  )
})

test('代课教师只限申请所在校区且不能是原教师', () => {
  const campusOneChange = findScheduleChange(3002)

  const campusOneTeachers = availableSubstituteTeachers(campusOneChange, teachers)
  assert.ok(campusOneTeachers.every((teacher) => teacher.campusId === 1))
  assert.ok(campusOneTeachers.every((teacher) => teacher.id !== 303))
  assert.deepEqual(
    campusOneTeachers.map((teacher) => teacher.id).sort(),
    [301, 302],
  )

  const campusTwoChange = findScheduleChange(3003)
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
        findWorkOrder(4001),
        '',
        901,
        '2026-08-07T12:20:00+08:00',
      ),
    /关闭工单前必须填写处理结果/,
  )

  const closed = closeWorkOrder(
    findWorkOrder(4001),
    '已核对签到，教师已更正反馈。',
    901,
    '2026-08-07T12:20:00+08:00',
  )
  assert.equal(closed.status, 'CLOSED')
  assert.equal(closed.closedAt, '2026-08-07T12:20:00+08:00')
})
