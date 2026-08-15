import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { mockNow, studentId } from './mockData'
import {
  getSubmissionHistory,
  getSubmissionViewStatus,
  resetMockSubmissions,
  submitAssignment,
} from './studentService'
import type { FileSummary } from '@k12/shared'

beforeEach(() => {
  resetMockSubmissions()
})

test('没有提交记录时派生为 NOT_SUBMITTED', () => {
  assert.equal(getSubmissionViewStatus(301, studentId), 'NOT_SUBMITTED')
  assert.equal(getSubmissionViewStatus(302, studentId), 'GRADED')
})

test('学生可以首次提交作业', () => {
  const submission = submitAssignment({
    assignmentId: 301,
    studentId,
    content: '第 6 题先通分，再计算。',
    attachments: [],
    submittedAt: mockNow,
  })

  assert.equal(submission.status, 'SUBMITTED')
  assert.equal(submission.attempt, 1)
  assert.equal(submission.content, '第 6 题先通分，再计算。')
})

test('已提交作业不能重复提交', () => {
  const input = {
    assignmentId: 301,
    studentId,
    content: '第一次提交',
    attachments: [],
    submittedAt: mockNow,
  }

  submitAssignment(input)
  assert.throws(() => submitAssignment(input), /不能重复提交/)
})

test('不允许迟交的作业在截止后不能提交', () => {
  assert.throws(
    () =>
      submitAssignment({
        assignmentId: 304,
        studentId,
        content: '补交观察记录',
        attachments: [],
        submittedAt: mockNow,
      }),
    /作业已截止/,
  )
})

test('不支持的附件类型会被拒绝', () => {
  const invalidAttachment: FileSummary = {
    id: 9001,
    originalName: 'homework.exe',
    mimeType: 'application/x-msdownload',
    byteSize: 1024,
    createdAt: mockNow,
  }

  assert.throws(
    () =>
      submitAssignment({
        assignmentId: 301,
        studentId,
        content: '',
        attachments: [invalidAttachment],
        submittedAt: mockNow,
      }),
    /附件仅支持/,
  )
})

test('需要订正时新增 attempt，并保留旧提交', () => {
  const submission = submitAssignment({
    assignmentId: 303,
    studentId,
    content: '已按评语补充完整句子。',
    attachments: [],
    submittedAt: mockNow,
  })
  const history = getSubmissionHistory(303, studentId)

  assert.equal(submission.attempt, 2)
  assert.equal(submission.status, 'SUBMITTED')
  assert.deepEqual(
    history.map((item) => item.attempt),
    [1, 2],
  )
})
