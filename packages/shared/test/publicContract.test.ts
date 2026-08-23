import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATTENDANCE_STATUSES,
  FEEDBACK_STATUSES,
  LEAVE_STATUSES,
  NOTIFICATION_TYPES,
  PUBLIC_REGISTRATION_ROLES,
  SCHEDULE_CHANGE_STATUSES,
  SCHEDULE_STATUSES,
  SUBMISSION_STATUSES,
  USER_ROLES,
  WORK_ORDER_STATUSES,
} from '../src/index.js'
import {
  MOCK_ACCOUNTS,
  MOCK_ACCOUNT_PASSWORD,
  MOCK_ACCOUNT_ROLES,
} from '../src/mockAccounts.js'

test('公共包发布六种唯一角色', () => {
  assert.equal(USER_ROLES.length, 6)
  assert.equal(new Set(USER_ROLES).size, 6)
  assert.deepEqual(MOCK_ACCOUNT_ROLES, USER_ROLES)
})

test('公开注册只允许家长和学生角色', () => {
  assert.deepEqual(PUBLIC_REGISTRATION_ROLES, ['PARENT', 'STUDENT'])
  assert.equal(PUBLIC_REGISTRATION_ROLES.includes('PARENT'), true)
  assert.equal(PUBLIC_REGISTRATION_ROLES.includes('STUDENT'), true)
})

test('十三个本地账号覆盖六种角色、两个校区和唯一身份', () => {
  assert.equal(MOCK_ACCOUNTS.length, 13)
  assert.equal(
    new Set(MOCK_ACCOUNTS.map(({ username }) => username)).size,
    MOCK_ACCOUNTS.length,
  )
  assert.equal(
    new Set(MOCK_ACCOUNTS.map(({ user }) => user.id)).size,
    MOCK_ACCOUNTS.length,
  )
  assert.deepEqual(
    [...new Set(MOCK_ACCOUNTS.map(({ user }) => user.campusId))],
    [1, 2],
  )

  for (const account of MOCK_ACCOUNTS) {
    assert.equal(account.password, MOCK_ACCOUNT_PASSWORD)
    assert.equal(account.active, true)
    assert.equal(Number.isInteger(account.user.id), true)
    assert.equal(Number.isInteger(account.user.campusId), true)
  }

  for (const role of USER_ROLES) {
    assert.equal(
      MOCK_ACCOUNTS.some(({ user }) => user.role === role),
      true,
      `${role} 必须至少有一个可登录账号`,
    )
  }
})

test('公共持久化状态与 7/28 字段契约一致', () => {
  assert.deepEqual(SCHEDULE_STATUSES, [
    'SCHEDULED',
    'CHANGED',
    'COMPLETED',
    'CANCELLED',
  ])
  assert.deepEqual(LEAVE_STATUSES, ['PENDING', 'APPROVED', 'REJECTED'])
  assert.deepEqual(ATTENDANCE_STATUSES, [
    'PRESENT',
    'LATE',
    'ABSENT',
    'LEAVE',
  ])
  assert.deepEqual(SUBMISSION_STATUSES, [
    'SUBMITTED',
    'GRADED',
    'REVISION_REQUIRED',
  ])
  assert.deepEqual(SCHEDULE_CHANGE_STATUSES, [
    'PENDING',
    'APPROVED',
    'REJECTED',
    'SUBSTITUTE_ASSIGNED',
    'COMPLETED',
  ])
  assert.deepEqual(FEEDBACK_STATUSES, [
    'PENDING_PARENT',
    'CONFIRMED',
    'DISPUTED',
  ])
  assert.deepEqual(WORK_ORDER_STATUSES, ['OPEN', 'PROCESSING', 'CLOSED'])
  assert.deepEqual(NOTIFICATION_TYPES, [
    'SCHEDULE_CHANGE',
    'FEEDBACK',
    'GENERAL',
  ])
})

test('页面派生状态不进入公共持久化状态', () => {
  const publicStatusValues = [
    ...SCHEDULE_STATUSES,
    ...LEAVE_STATUSES,
    ...ATTENDANCE_STATUSES,
    ...SUBMISSION_STATUSES,
    ...SCHEDULE_CHANGE_STATUSES,
    ...FEEDBACK_STATUSES,
    ...WORK_ORDER_STATUSES,
  ]

  assert.equal(publicStatusValues.includes('NOT_SUBMITTED'), false)
  assert.equal(publicStatusValues.includes('DRAFT'), false)
})
