import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Submission } from '@k12/shared'

import {
  calculateGlobalProgress,
  formatCountdown,
  getAssignmentActionLabel,
  getAssignmentProgress,
  getScoreGrade,
  getSubmissionStatusLabel,
  isAssignmentSubmissionClosed,
} from './assignmentPresentation'
import { listAssignmentRows } from './assignmentListService'
import { createStudentOverviewFixture, mockNow, studentId } from './mockData'
import type { StudentOverview } from './studentBusinessClient'

function withSubmission(
  overview: StudentOverview,
  item: Submission,
): StudentOverview {
  return { ...overview, submissions: [...overview.submissions, item] }
}

test('全局完成率由公共提交状态动态计算', () => {
  assert.equal(
    calculateGlobalProgress([
      'NOT_SUBMITTED',
      'SUBMITTED',
      'GRADED',
      'REVISION_REQUIRED',
    ]),
    50,
  )
  assert.equal(calculateGlobalProgress([]), 0)
})

test('倒计时根据当前时间和截止时间派生', () => {
  const now = '2026-08-07T10:00:00+08:00'

  assert.equal(formatCountdown('2026-08-09T10:00:00+08:00', now), '剩余 2 天')
  assert.equal(formatCountdown('2026-08-07T12:30:00+08:00', now), '剩余 3 小时')
  assert.equal(formatCountdown('2026-08-07T09:59:59+08:00', now), '已截止')
})

test('页面文案由公共大写状态映射，不改变业务契约', () => {
  assert.equal(getSubmissionStatusLabel('REVISION_REQUIRED'), '需订正')
  assert.equal(getAssignmentActionLabel('REVISION_REQUIRED'), '去订正')
  assert.equal(getAssignmentActionLabel('NOT_SUBMITTED', true), '查看详情')
  assert.deepEqual(getAssignmentProgress('GRADED'), {
    percent: 100,
    text: '1/1 已批改',
  })
})

test('成绩等级仅作为页面展示字段派生', () => {
  assert.equal(getScoreGrade(95), 'A+')
  assert.equal(getScoreGrade(82), 'A')
  assert.equal(getScoreGrade(), undefined)
})

test('截止状态与服务提交规则一致', () => {
  const rows = listAssignmentRows(createStudentOverviewFixture())

  const expiredAssignment = rows.find(
    ({ assignment }) => assignment.id === 3004,
  )?.assignment
  const openAssignment = rows.find(
    ({ assignment }) => assignment.id === 3001,
  )?.assignment

  assert.ok(expiredAssignment)
  assert.equal(isAssignmentSubmissionClosed(expiredAssignment, mockNow), true)
  assert.ok(openAssignment)
  assert.equal(isAssignmentSubmissionClosed(openAssignment, mockNow), false)
})

test('提交后列表状态和全局完成率会回写', () => {
  const before = createStudentOverviewFixture()
  const beforeRows = listAssignmentRows(before)

  assert.equal(
    beforeRows.find(({ assignment }) => assignment.id === 3001)?.status,
    'NOT_SUBMITTED',
  )
  assert.equal(
    calculateGlobalProgress(beforeRows.map(({ status }) => status)),
    25,
  )

  const after = withSubmission(before, {
    id: 4004,
    assignmentId: 3001,
    studentId,
    attempt: 1,
    content: '列表集成测试提交',
    attachments: [],
    status: 'SUBMITTED',
    submittedAt: mockNow,
    score: null,
    teacherComment: '',
    gradedBy: null,
    gradedAt: null,
    updatedAt: mockNow,
  })
  const afterRows = listAssignmentRows(after)

  assert.equal(
    afterRows.find(({ assignment }) => assignment.id === 3001)?.status,
    'SUBMITTED',
  )
  assert.equal(
    calculateGlobalProgress(afterRows.map(({ status }) => status)),
    50,
  )
})
