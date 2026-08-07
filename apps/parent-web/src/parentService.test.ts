import assert from 'node:assert/strict'
import test from 'node:test'
import { mockParentCredentials } from './mockData'
import {
  authenticateParent,
  ensureBoundStudent,
  getNoticesByStudent,
  getSchedulesByStudent,
  submitLeaveRequest,
  updateFeedbackStatus
} from './parentService'

test('家长可以使用 Mock 账号登录', () => {
  const user = authenticateParent(
    mockParentCredentials.username,
    mockParentCredentials.password,
  )

  assert.equal(user.id, 1)
  assert.equal(user.displayName, '王女士')
})

test('错误的家长账号或密码不能登录', () => {
  assert.throws(
    () => authenticateParent(mockParentCredentials.username, 'wrong-password'),
    /账号或密码错误/,
  )
  assert.throws(
    () => authenticateParent('not-a-parent', mockParentCredentials.password),
    /账号或密码错误/,
  )
})

test('家长可以查看已绑定学生课表', () => {
  assert.equal(getSchedulesByStudent(2).length, 2)
})

test('家长不能访问未绑定学生', () => {
  assert.throws(() => ensureBoundStudent(999), /家长只能查看已绑定学生的数据/)
})

test('家长可以为已绑定学生提交请假', () => {
  const request = submitLeaveRequest({
    studentId: 2,
    scheduleId: 1,
    reason: '身体不适',
    contactPhone: '13800000001',
  })

  assert.equal(request.status, 'PENDING')
  assert.equal(request.reason, '身体不适')
})

test('调课通知包含原时间、新时间和代课教师', () => {
  const notice = getNoticesByStudent(2).find(
    (item) => item.type === 'SCHEDULE_CHANGE',
  )

  assert.equal(notice?.originalTime, '2026-08-01 09:00-10:30')
  assert.equal(notice?.newTime, '2026-08-01 16:00-17:30')
  assert.equal(notice?.substituteTeacherName, '周老师')
})

test('家长可以确认反馈或填写原因后提出异议', () => {
  assert.equal(updateFeedbackStatus(1, 'CONFIRMED').status, 'CONFIRMED')
  const disputed = updateFeedbackStatus(1, 'DISPUTED', '本周朗读记录已完成')
  assert.equal(disputed.status, 'DISPUTED')
  assert.equal(disputed.parentResponse, '本周朗读记录已完成')
})
