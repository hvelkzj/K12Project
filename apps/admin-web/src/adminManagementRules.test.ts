import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canDisableCurrentAdmin,
  canManageUser,
  canReviewLeaveRequest,
  isScheduleIdentityLocked,
  runManagementAction,
  validateRequiredText,
  validateScheduleTime,
} from './adminManagementRules'
import type { UserAccount } from './types'

const systemAdmin: UserAccount = {
  id: 999,
  campusId: 1,
  displayName: '系统管理员',
  username: 'system_999',
  role: 'SYSTEM_ADMIN',
  active: true,
}

test('排课时间校验：结束时间必须晚于开始时间', () => {
  assert.equal(validateScheduleTime('09:00', '10:30'), null)
  assert.equal(validateScheduleTime('10:30', '09:00'), '结束时间必须晚于开始时间')
  assert.equal(validateScheduleTime('09:00', '09:00'), '结束时间必须晚于开始时间')
})

test('必填文本校验：空白返回错误消息', () => {
  assert.equal(validateRequiredText('已核实', '不能为空'), null)
  assert.equal(validateRequiredText('   ', '不能为空'), '不能为空')
  assert.equal(validateRequiredText('', '不能为空'), '不能为空')
})

test('禁止停用当前登录的系统管理员', () => {
  assert.equal(
    canDisableCurrentAdmin(systemAdmin, { id: 999 }),
    false,
  )
  assert.equal(
    canDisableCurrentAdmin(systemAdmin, { id: 901 }),
    true,
  )
  assert.equal(
    canDisableCurrentAdmin(systemAdmin, null),
    true,
  )
})

test('其他系统管理员可以被停用', () => {
  const anotherAdmin: UserAccount = {
    id: 998,
    campusId: 2,
    displayName: '另一管理员',
    username: 'system_998',
    role: 'SYSTEM_ADMIN',
    active: true,
  }

  assert.equal(
    canDisableCurrentAdmin(anotherAdmin, { id: 999 }),
    true,
  )
})

test('已停用的当前管理员可被重新启用', () => {
  const disabledCurrent: UserAccount = {
    ...systemAdmin,
    active: false,
  }

  assert.equal(
    canDisableCurrentAdmin(disabledCurrent, { id: 999 }),
    true,
  )
})

test('账号启停只对系统管理员开放', () => {
  assert.equal(canManageUser('SYSTEM_ADMIN'), true)
  assert.equal(canManageUser('ACADEMIC_ADMIN'), false)
  assert.equal(canManageUser('TEACHER'), false)
  assert.equal(canManageUser(undefined), false)
})

test('只有待审批请假可以进入审批写操作', () => {
  assert.equal(canReviewLeaveRequest('PENDING'), true)
  assert.equal(canReviewLeaveRequest('APPROVED'), false)
  assert.equal(canReviewLeaveRequest('REJECTED'), false)
})

test('编辑课次时锁定校区、班级和课程身份字段', () => {
  assert.equal(isScheduleIdentityLocked(null), false)
  assert.equal(isScheduleIdentityLocked(1001), true)
})

test('状态变更锁阻止并发重复请求并在完成后释放', async () => {
  const state = { pendingKey: null as string | null }
  let release: ((value: string) => void) | undefined
  let calls = 0

  const first = runManagementAction(state, 'leave-8001', async () => {
    calls += 1
    return new Promise<string>((resolve) => {
      release = resolve
    })
  })
  await Promise.resolve()

  assert.equal(state.pendingKey, 'leave-8001')
  const duplicate = await runManagementAction(
    state,
    'leave-8001',
    async () => {
      calls += 1
      return '重复请求'
    },
  )
  assert.deepEqual(duplicate, { started: false })
  assert.equal(calls, 1)

  release?.('审批完成')
  assert.deepEqual(await first, { started: true, value: '审批完成' })
  assert.equal(state.pendingKey, null)
})

test('状态变更失败后也会释放操作锁', async () => {
  const state = { pendingKey: null as string | null }

  await assert.rejects(
    runManagementAction(state, 'schedule-1001', async () => {
      throw new Error('排课冲突')
    }),
    /排课冲突/,
  )
  assert.equal(state.pendingKey, null)
})
