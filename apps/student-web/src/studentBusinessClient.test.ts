import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FileSummary } from '@k12/shared'

import { createStudentOverviewFixture, mockNow } from './mockData'
import {
  createStudentBusinessClient,
  StudentBusinessError,
} from './studentBusinessClient'

interface FakeAuthClient {
  token: string | null
  clearedCount: number
  getAccessToken(): string | null
  clearAccessToken(): void
}

function createFakeAuth(token: string | null): FakeAuthClient {
  return {
    token,
    clearedCount: 0,
    getAccessToken() {
      return this.token
    },
    clearAccessToken() {
      this.clearedCount += 1
      this.token = null
    },
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface FetchCall {
  url: string
  init?: RequestInit
}

function createFakeFetch(
  respond: (url: string, init?: RequestInit) => Response,
) {
  const calls: FetchCall[] = []
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    return respond(url, init)
  }

  return { calls, fetchImpl }
}

function singleCall(calls: FetchCall[]): FetchCall {
  assert.equal(calls.length, 1)
  return calls[0] as FetchCall
}

function authHeaders(init: RequestInit | undefined): Record<string, string> {
  return (init?.headers as Record<string, string>) ?? {}
}

const attachment: FileSummary = {
  id: 9001,
  originalName: '作业照片.png',
  mimeType: 'image/png',
  byteSize: 204_800,
  createdAt: mockNow,
}

test('概览请求携带 Bearer Token 并返回学生概览', async () => {
  const fixture = createStudentOverviewFixture()
  const { calls, fetchImpl } = createFakeFetch(() => jsonResponse(200, fixture))
  const auth = createFakeAuth('token-101')
  const client = createStudentBusinessClient({ fetchImpl, authClient: auth })

  const overview = await client.getOverview()

  assert.equal(overview.student.id, 101)
  const call = singleCall(calls)
  assert.equal(call.url, 'http://127.0.0.1:3000/student/overview')
  assert.equal(call.init?.method ?? 'GET', 'GET')
  assert.equal(authHeaders(call.init).Authorization, 'Bearer token-101')
})

test('提交请求只发送 assignmentId、content 和 attachments', async () => {
  const serverSubmission = {
    id: 5001,
    assignmentId: 3001,
    studentId: 101,
    attempt: 1,
    content: '第 6 题先通分，再计算。',
    attachments: [attachment],
    status: 'SUBMITTED',
    submittedAt: mockNow,
    score: null,
    teacherComment: '',
    gradedBy: null,
    gradedAt: null,
    updatedAt: mockNow,
  }
  const { calls, fetchImpl } = createFakeFetch(() =>
    jsonResponse(201, serverSubmission),
  )
  const auth = createFakeAuth('token-101')
  const client = createStudentBusinessClient({ fetchImpl, authClient: auth })

  const input = {
    assignmentId: 3001,
    content: '第 6 题先通分，再计算。',
    attachments: [attachment],
  }
  const submission = await client.submitWork(input)

  assert.equal(submission.attempt, 1)
  const call = singleCall(calls)
  assert.equal(call.url, 'http://127.0.0.1:3000/student/submissions')
  assert.equal(call.init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(call.init?.body)), input)
  assert.equal(authHeaders(call.init)['Content-Type'], 'application/json')
})

test('业务接口返回 401 时清除 Token 并抛出会话错误', async () => {
  const { fetchImpl } = createFakeFetch(() =>
    jsonResponse(401, { code: 'INVALID_SESSION', message: '登录已失效，请重新登录' }),
  )
  const auth = createFakeAuth('token-101')
  const client = createStudentBusinessClient({ fetchImpl, authClient: auth })

  await assert.rejects(
    client.getOverview(),
    (error: unknown) =>
      error instanceof StudentBusinessError &&
      error.status === 401 &&
      error.code === 'INVALID_SESSION',
  )
  assert.equal(auth.clearedCount, 1)
  assert.equal(auth.token, null)
})

test('403、404、409、422 显示服务端信息且不清除 Token', async () => {
  for (const status of [403, 404, 409, 422]) {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(status, { code: `CODE_${status}`, message: `服务端消息 ${status}` }),
    )
    const auth = createFakeAuth('token-101')
    const client = createStudentBusinessClient({ fetchImpl, authClient: auth })

    await assert.rejects(
      client.submitWork({ assignmentId: 3001, content: '内容', attachments: [] }),
      (error: unknown) =>
        error instanceof StudentBusinessError &&
        error.status === status &&
        error.message === `服务端消息 ${status}`,
    )
    assert.equal(auth.clearedCount, 0, `status ${status} 不应清除 Token`)
  }
})

test('重复提交与截止后提交的冲突消息来自服务端', async () => {
  const conflictMessage = '作业已截止，不能继续提交'
  const { fetchImpl } = createFakeFetch(() =>
    jsonResponse(409, { code: 'CONFLICT', message: conflictMessage }),
  )
  const client = createStudentBusinessClient({
    fetchImpl,
    authClient: createFakeAuth('token-101'),
  })

  await assert.rejects(
    client.submitWork({ assignmentId: 3001, content: '补交', attachments: [] }),
    (error: unknown) =>
      error instanceof StudentBusinessError &&
      error.status === 409 &&
      error.message === conflictMessage,
  )
})

test('网络错误归类为 NETWORK_ERROR 且不清除 Token', async () => {
  const fetchImpl = () => Promise.reject(new Error('socket hang up'))
  const auth = createFakeAuth('token-101')
  const client = createStudentBusinessClient({ fetchImpl, authClient: auth })

  await assert.rejects(
    client.getOverview(),
    (error: unknown) =>
      error instanceof StudentBusinessError &&
      error.status === 0 &&
      error.code === 'NETWORK_ERROR',
  )
  assert.equal(auth.clearedCount, 0)
})

test('缺少 Token 时不发起请求并回到登录', async () => {
  let fetched = false
  const fetchImpl = () => {
    fetched = true
    return Promise.resolve(jsonResponse(200, createStudentOverviewFixture()))
  }
  const auth = createFakeAuth(null)
  const client = createStudentBusinessClient({ fetchImpl, authClient: auth })

  await assert.rejects(
    client.getOverview(),
    (error: unknown) =>
      error instanceof StudentBusinessError &&
      error.status === 401 &&
      error.code === 'AUTH_REQUIRED',
  )
  assert.equal(fetched, false)
  assert.equal(auth.clearedCount, 1)
})
