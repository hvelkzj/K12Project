import assert from 'node:assert/strict'
import test from 'node:test'

import {
  confirmedFeedback,
  generalNotice,
  leaveRequest,
  parentBindings,
  pendingFeedback,
  scheduleChangeNotice,
} from './parentBusinessFixtures.test'
import {
  canMarkNotificationRead,
  canSubmitFeedbackResponse,
  clearFeedbackResponseDraft,
  countPendingParentFeedback,
  countUnreadNotifications,
  feedbackResponseDraft,
  isCurrentStudentAction,
  isLeaveEligibleSchedule,
  isLatestOverviewRequest,
  leaveStatusLabel,
  mergeParentNotices,
  overviewRetryStudentId,
  replaceReadNotification,
  replaceReadScheduleChangeNotice,
  updateFeedbackResponseDraft,
} from './parentViewHelpers'

test('概览失败后重试当前绑定学生', () => {
  assert.equal(overviewRetryStudentId(parentBindings, 102), 102)
  assert.equal(overviewRetryStudentId(parentBindings, 999), null)
  assert.equal(overviewRetryStudentId(parentBindings, null), null)
  assert.equal(overviewRetryStudentId([], 101), null)
})

test('待看反馈只统计等待家长处理的状态', () => {
  assert.equal(countPendingParentFeedback([pendingFeedback]), 1)
  assert.equal(countPendingParentFeedback([confirmedFeedback]), 0)
  assert.equal(
    countPendingParentFeedback([pendingFeedback, confirmedFeedback]),
    1,
  )
})

test('首页未读通知数量统计普通通知和调课通知', () => {
  const notices = mergeParentNotices(
    [generalNotice, scheduleChangeNotice.notification],
    [scheduleChangeNotice],
  )

  assert.equal(notices.length, 2)
  assert.ok('notification' in notices[0]!)
  assert.equal(
    countUnreadNotifications(notices),
    2,
  )
  assert.equal(
    countUnreadNotifications([
      { ...generalNotice, readAt: '2026-08-18T18:00:00+08:00' },
      scheduleChangeNotice,
    ]),
    1,
  )
})

test('通知读取和概览请求防止重复操作与旧响应回写', () => {
  assert.equal(canMarkNotificationRead(generalNotice, null), true)
  assert.equal(canMarkNotificationRead(generalNotice, generalNotice.id), false)
  assert.equal(
    canMarkNotificationRead(
      { ...generalNotice, readAt: '2026-08-18T18:00:00+08:00' },
      null,
    ),
    false,
  )
  assert.equal(isLatestOverviewRequest(3, 3), true)
  assert.equal(isLatestOverviewRequest(2, 3), false)
})

test('学生写操作响应只回写发起操作的学生页面', () => {
  assert.equal(isCurrentStudentAction(101, 101), true)
  assert.equal(isCurrentStudentAction(101, 102), false)
  assert.equal(isCurrentStudentAction(101, null), false)
})

test('反馈响应防止已处理或保存中的重复提交', () => {
  assert.equal(canSubmitFeedbackResponse(pendingFeedback, false), true)
  assert.equal(canSubmitFeedbackResponse(pendingFeedback, true), false)
  assert.equal(canSubmitFeedbackResponse(confirmedFeedback, false), false)
})

test('反馈异议草稿按反馈隔离且成功后只清除对应草稿', () => {
  const firstDrafts = updateFeedbackResponseDraft({}, 5001, '核对课堂记录')
  const twoDrafts = updateFeedbackResponseDraft(firstDrafts, 5002, '核对作业记录')

  assert.equal(feedbackResponseDraft(twoDrafts, 5001), '核对课堂记录')
  assert.equal(feedbackResponseDraft(twoDrafts, 5002), '核对作业记录')
  assert.equal(feedbackResponseDraft(twoDrafts, 9999), '')

  const remainingDrafts = clearFeedbackResponseDraft(twoDrafts, 5001)
  assert.equal(feedbackResponseDraft(remainingDrafts, 5001), '')
  assert.equal(feedbackResponseDraft(remainingDrafts, 5002), '核对作业记录')
})

test('请假三种状态显示为家长可读文案', () => {
  assert.equal(leaveStatusLabel(leaveRequest.status), '待审批')
  assert.equal(leaveStatusLabel('APPROVED'), '已批准')
  assert.equal(leaveStatusLabel('REJECTED'), '已拒绝')
})

test('请假课程只包含尚未结束的正常或已调课课次', () => {
  const baseSchedule = {
    id: 1001,
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    lessonDate: '2026-08-25',
    startTime: '09:00:00',
    endTime: '10:30:00',
    room: 'A-302',
    status: 'SCHEDULED' as const,
  }
  const now = Date.parse('2026-08-24T10:00:00+08:00')

  assert.equal(isLeaveEligibleSchedule(baseSchedule, now), true)
  assert.equal(
    isLeaveEligibleSchedule({ ...baseSchedule, status: 'CHANGED' }, now),
    true,
  )
  assert.equal(
    isLeaveEligibleSchedule({ ...baseSchedule, status: 'COMPLETED' }, now),
    false,
  )
  assert.equal(
    isLeaveEligibleSchedule(
      { ...baseSchedule, lessonDate: '2026-08-23' },
      now,
    ),
    false,
  )
})

test('通知已读只替换匹配的普通通知', () => {
  const updated = {
    ...generalNotice,
    readAt: '2026-08-18T18:00:00+08:00',
  }

  const replaced = replaceReadNotification([generalNotice], updated)

  assert.equal(replaced[0]?.readAt, updated.readAt)
})

test('调课通知已读只替换嵌套 notification', () => {
  const updated = {
    ...scheduleChangeNotice.notification,
    readAt: '2026-08-18T18:00:00+08:00',
  }

  const replaced = replaceReadScheduleChangeNotice(
    [scheduleChangeNotice],
    updated,
  )

  assert.equal(replaced[0]?.notification.readAt, updated.readAt)
  assert.equal(replaced[0]?.originalTeacherName, '李老师')
})
