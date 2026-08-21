import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FileSummary, Submission } from '@k12/shared'

import {
  assignmentDraftsStorageKey,
  createAssignmentDraftStore,
} from './assignmentDrafts'
import { createStudentOverviewFixture, mockNow, studentId } from './mockData'
import { getSubmissionHistory } from './studentService'
import { createDraftSubmissionFlow } from './draftSubmission'
import type { SubmitWorkInput } from './studentBusinessClient'

interface FakeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function createStorage(initial: Record<string, string> = {}): FakeStorage {
  const values = new Map(Object.entries(initial))

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

const attachment: FileSummary = {
  id: 9001,
  originalName: '草稿图片.png',
  mimeType: 'image/png',
  byteSize: 102_400,
  createdAt: mockNow,
}

function createFakeService() {
  const submitted: SubmitWorkInput[] = []
  let failNext = false

  const service = {
    submitted,
    failNextOnce() {
      failNext = true
    },
    async loadOverview() {
      return createStudentOverviewFixture()
    },
    async submitWork(input: SubmitWorkInput): Promise<Submission> {
      if (failNext) {
        failNext = false
        throw new Error('服务端拒绝提交')
      }
      submitted.push(input)
      return {
        id: 5001,
        assignmentId: input.assignmentId,
        studentId,
        attempt: 1,
        content: input.content,
        attachments: input.attachments,
        status: 'SUBMITTED',
        submittedAt: mockNow,
        score: null,
        teacherComment: '',
        gradedBy: null,
        gradedAt: null,
        updatedAt: mockNow,
      }
    },
  }

  return service
}

test('保存后可读取草稿', () => {
  const store = createAssignmentDraftStore(createStorage())

  store.save(3001, { content: '草稿正文', attachments: [attachment] })

  assert.deepEqual(store.load(3001), {
    content: '草稿正文',
    attachments: [attachment],
  })
})

test('草稿按作业 ID 隔离', () => {
  const store = createAssignmentDraftStore(createStorage())

  store.save(3001, { content: '第一份草稿', attachments: [] })
  store.save(3003, { content: '订正草稿', attachments: [attachment] })

  assert.equal(store.load(3001)?.content, '第一份草稿')
  assert.equal(store.load(3003)?.content, '订正草稿')
  assert.equal(store.load(3002), null)
})

test('清除草稿只删除对应作业', () => {
  const store = createAssignmentDraftStore(createStorage())

  store.save(3001, { content: '第一份草稿', attachments: [] })
  store.save(3003, { content: '订正草稿', attachments: [] })
  store.clear(3001)

  assert.equal(store.load(3001), null)
  assert.equal(store.load(3003)?.content, '订正草稿')
})

test('提交成功后清理草稿', async () => {
  const store = createAssignmentDraftStore(createStorage())
  const service = createFakeService()
  const flow = createDraftSubmissionFlow(service, store)

  store.save(3001, { content: '准备提交的正文', attachments: [] })
  await flow.submitWork({ assignmentId: 3001, content: '准备提交的正文', attachments: [] })

  assert.equal(store.load(3001), null)
  assert.equal(service.submitted.length, 1)
})

test('提交失败时保留草稿', async () => {
  const store = createAssignmentDraftStore(createStorage())
  const service = createFakeService()
  const flow = createDraftSubmissionFlow(service, store)

  store.save(3001, { content: '失败也要保留的正文', attachments: [attachment] })
  service.failNextOnce()

  await assert.rejects(
    flow.submitWork({ assignmentId: 3001, content: '失败也要保留的正文', attachments: [attachment] }),
    /服务端拒绝提交/,
  )
  assert.deepEqual(store.load(3001), {
    content: '失败也要保留的正文',
    attachments: [attachment],
  })
  assert.equal(service.submitted.length, 0)
})

test('订正草稿不覆盖首次提交历史', () => {
  const overview = createStudentOverviewFixture()
  const store = createAssignmentDraftStore(createStorage())

  const historyBefore = getSubmissionHistory(overview, 3003)
  assert.deepEqual(
    historyBefore.map((item) => item.attempt),
    [1],
  )

  store.save(3003, { content: '第二次订正草稿', attachments: [] })

  const historyAfter = getSubmissionHistory(overview, 3003)
  assert.deepEqual(
    historyAfter.map((item) => item.attempt),
    [1],
  )
  assert.equal(historyAfter[0]?.content, '第一次朗读文字稿。')
})

test('存储数据损坏时按无草稿处理', () => {
  const store = createAssignmentDraftStore(
    createStorage({ [assignmentDraftsStorageKey]: '{not-json' }),
  )

  assert.equal(store.load(3001), null)

  store.save(3001, { content: '可重新写入', attachments: [] })
  assert.equal(store.load(3001)?.content, '可重新写入')
})

test('合法 JSON 中的无效草稿结构不会导致提交页崩溃', () => {
  const store = createAssignmentDraftStore(
    createStorage({
      [assignmentDraftsStorageKey]: JSON.stringify({
        3001: { content: '缺少附件数组' },
        3002: { content: '附件类型错误', attachments: [{}] },
        3003: { content: '仍然有效', attachments: [] },
      }),
    }),
  )

  assert.equal(store.load(3001), null)
  assert.equal(store.load(3002), null)
  assert.deepEqual(store.load(3003), {
    content: '仍然有效',
    attachments: [],
  })
})

test('刷新页面后草稿仍然存在', () => {
  const storage = createStorage()
  const first = createAssignmentDraftStore(storage)
  first.save(3001, { content: '刷新前保存的正文', attachments: [attachment] })

  // 模拟刷新：用同一存储创建新实例
  const second = createAssignmentDraftStore(storage)
  assert.deepEqual(second.load(3001), {
    content: '刷新前保存的正文',
    attachments: [attachment],
  })
})
