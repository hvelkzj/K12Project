import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import {
  ensureBoundStudent,
  getNoticesByStudent,
  getSchedulesByStudent,
  resetParentServiceState,
  submitLeaveRequest,
  updateFeedbackStatus
} from './parentService'

beforeEach(() => {
  resetParentServiceState()
})

test('家长可以查看已绑定学生课表', () => {
  assert.equal(getSchedulesByStudent(101).length, 2)
})

test('家长不能访问未绑定学生', () => {
  assert.throws(() => ensureBoundStudent(999), /家长只能查看已绑定学生的数据/)
})

test('家长可以为已绑定学生提交请假', () => {
  const request = submitLeaveRequest({
    studentId: 101,
    scheduleId: 1,
    reason: '身体不适',
    contactPhone: '13800000001',
  })

  assert.equal(request.status, 'PENDING')
  assert.equal(request.reason, '身体不适')
})

test('请假必填字段缺失时会拦截提交', () => {
  assert.throws(
    () =>
      submitLeaveRequest({
        studentId: 101,
        scheduleId: 1,
        reason: '   ',
        contactPhone: '13800000001',
      }),
    /请假原因不能为空/,
  )
})

test('同一课程不能重复提交待处理请假', () => {
  const input = {
    studentId: 101,
    scheduleId: 1,
    reason: '身体不适',
    contactPhone: '13800000001',
  }

  submitLeaveRequest(input)

  assert.throws(
    () => submitLeaveRequest(input),
    /该课程已提交待处理请假申请/,
  )
})

test('调课通知包含原时间、新时间和代课教师', () => {
  const notice = getNoticesByStudent(101).find(
    (item) =>
      'notification' in item && item.notification.type === 'SCHEDULE_CHANGE',
  )

  assert.ok(notice && 'notification' in notice)
  assert.equal(notice.originalDate, '2026-08-01')
  assert.equal(notice.originalStartTime, '09:00')
  assert.equal(notice.originalEndTime, '10:30')
  assert.equal(notice.newDate, '2026-08-01')
  assert.equal(notice.newStartTime, '16:00')
  assert.equal(notice.newEndTime, '17:30')
  assert.equal(notice.substituteTeacherName, '周老师')
})

test('家长可以确认反馈或填写原因后提出异议', () => {
  assert.equal(updateFeedbackStatus(1, 'CONFIRMED').status, 'CONFIRMED')
  const disputed = updateFeedbackStatus(1, 'DISPUTED', '本周朗读记录已完成')
  assert.equal(disputed.status, 'DISPUTED')
  assert.equal(disputed.parentResponse, '本周朗读记录已完成')
})
