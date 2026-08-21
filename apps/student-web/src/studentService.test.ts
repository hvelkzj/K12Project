import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FileSummary, Submission } from '@k12/shared'

import { calculateGlobalProgress } from './assignmentPresentation'
import { listAssignmentRows } from './assignmentListService'
import { createStudentOverviewFixture, mockNow, studentId } from './mockData'
import {
  applySubmissionToOverview,
  createStudentDataService,
  getLatestSubmission,
  getSubmissionHistory,
  getSubmissionViewStatus,
  validateSubmissionInput,
} from './studentService'
import type {
  StudentBusinessClient,
  StudentOverview,
  SubmitWorkInput,
} from './studentBusinessClient'

function submission(
  assignmentId: number,
  overrides: Partial<Submission> = {},
): Submission {
  return {
    id: 5001,
    assignmentId,
    studentId,
    attempt: 1,
    content: '提交内容',
    attachments: [],
    status: 'SUBMITTED',
    submittedAt: mockNow,
    score: null,
    teacherComment: '',
    gradedBy: null,
    gradedAt: null,
    updatedAt: mockNow,
    ...overrides,
  }
}

function withSubmission(
  overview: StudentOverview,
  item: Submission,
): StudentOverview {
  return { ...overview, submissions: [...overview.submissions, item] }
}

function createFakeBusinessClient() {
  const submitted: SubmitWorkInput[] = []
  const client: StudentBusinessClient = {
    getOverview() {
      return Promise.resolve(createStudentOverviewFixture())
    },
    submitWork(input) {
      submitted.push(input)
      return Promise.resolve(
        submission(input.assignmentId, { attempt: 1, content: input.content }),
      )
    },
  }

  return { client, submitted }
}

test('概览数据派生作业列表状态', () => {
  const rows = listAssignmentRows(createStudentOverviewFixture())

  assert.equal(
    rows.find(({ assignment }) => assignment.id === 3001)?.status,
    'NOT_SUBMITTED',
  )
  assert.equal(
    rows.find(({ assignment }) => assignment.id === 3002)?.status,
    'SUBMITTED',
  )
  assert.equal(
    rows.find(({ assignment }) => assignment.id === 3003)?.status,
    'REVISION_REQUIRED',
  )
})

test('没有提交记录时派生为 NOT_SUBMITTED', () => {
  const overview = createStudentOverviewFixture()

  assert.equal(getSubmissionViewStatus(overview, 3001), 'NOT_SUBMITTED')
  assert.equal(getSubmissionViewStatus(overview, 3002), 'SUBMITTED')
})

test('正文和附件不能同时为空', () => {
  assert.throws(
    () => validateSubmissionInput({ content: '', attachments: [] }),
    /不能同时为空/,
  )
  assert.throws(
    () => validateSubmissionInput({ content: ' ', attachments: [] }),
    /不能同时为空/,
  )
  assert.doesNotThrow(() =>
    validateSubmissionInput({ content: '正文', attachments: [] }),
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
      validateSubmissionInput({ content: '正文', attachments: [invalidAttachment] }),
    /附件仅支持/,
  )
})

test('超过 10 MB 的附件会被拒绝', () => {
  const oversizedAttachment: FileSummary = {
    id: 9002,
    originalName: 'big.pdf',
    mimeType: 'application/pdf',
    byteSize: 11 * 1024 * 1024,
    createdAt: mockNow,
  }

  assert.throws(
    () =>
      validateSubmissionInput({ content: '', attachments: [oversizedAttachment] }),
    /不能超过 10 MB/,
  )
})

test('订正产生新 attempt，旧记录仍可查看', () => {
  const overview = withSubmission(
    createStudentOverviewFixture(),
    submission(3003, {
      id: 4003,
      attempt: 2,
      status: 'SUBMITTED',
      content: '已按评语补充完整句子。',
    }),
  )
  const history = getSubmissionHistory(overview, 3003)

  assert.deepEqual(
    history.map((item) => item.attempt),
    [1, 2],
  )
  assert.equal(getSubmissionViewStatus(overview, 3003), 'SUBMITTED')
})

test('提交成功后重新加载概览，列表状态和完成率更新', () => {
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

  const after = withSubmission(before, submission(3001, { id: 4004 }))
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

test('提交接口返回后可立即回写概览且重复回写不会产生重复记录', () => {
  const before = createStudentOverviewFixture()
  const created = submission(3001, { id: 4999 })

  const once = applySubmissionToOverview(before, created)
  const twice = applySubmissionToOverview(once, {
    ...created,
    content: '服务端返回的最新正文',
  })

  assert.equal(getSubmissionViewStatus(once, 3001), 'SUBMITTED')
  assert.equal(
    twice.submissions.filter((item) => item.id === created.id).length,
    1,
  )
  assert.equal(getLatestSubmission(twice, 3001)?.content, '服务端返回的最新正文')
})

test('数据服务提交复用客户端且只发送契约字段', async () => {
  const { client, submitted } = createFakeBusinessClient()
  const dataService = createStudentDataService(client)
  const input = {
    assignmentId: 3001,
    content: '第 6 题先通分，再计算。',
    attachments: [],
  }

  const result = await dataService.submitWork(input)

  assert.equal(result.status, 'SUBMITTED')
  assert.equal(submitted.length, 1)
  assert.deepEqual(submitted[0], input)
})

test('客户端校验失败时不调用接口', async () => {
  const { client, submitted } = createFakeBusinessClient()
  const dataService = createStudentDataService(client)

  await assert.rejects(
    dataService.submitWork({ assignmentId: 3001, content: '', attachments: [] }),
    /不能同时为空/,
  )
  assert.equal(submitted.length, 0)
})
