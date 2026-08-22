import assert from 'node:assert/strict'
import test from 'node:test'

import {
  confirmedFeedback,
  generalNotice,
  parentBindings,
  pendingFeedback,
  scheduleChangeNotice,
} from './parentBusinessFixtures.test'
import {
  countPendingParentFeedback,
  overviewRetryStudentId,
  replaceReadNotification,
  replaceReadScheduleChangeNotice,
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
