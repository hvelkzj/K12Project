import assert from 'node:assert/strict'
import test from 'node:test'

import {
  confirmedFeedback,
  parentBindings,
  pendingFeedback,
} from './parentBusinessFixtures.test'
import {
  countPendingParentFeedback,
  overviewRetryStudentId,
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
