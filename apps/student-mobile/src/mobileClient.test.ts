import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoginResponse, StudentOverview } from '@k12/shared'

import {
  createMobileStudentClient,
  mobileTokenStorageKey,
  MobileClientError,
  type MobileRequest,
  type MobileResponse,
  type MobileStorage,
  type MobileTransport,
} from './mobileClient'

function memoryStorage(): MobileStorage {
  const values = new Map<string, string>()
  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => values.set(key, value),
    remove: (key) => values.delete(key),
  }
}

function responseTransport(
  handler: (input: MobileRequest) => MobileResponse<unknown>,
) {
  const calls: MobileRequest[] = []
  const transport: MobileTransport = {
    async request<T>(input: MobileRequest) {
      calls.push(input)
      return handler(input) as MobileResponse<T>
    },
    async download() {
      return { status: 200, tempFilePath: '/tmp/courseware.pdf' }
    },
  }
  return { calls, transport }
}

const studentLogin: LoginResponse = {
  accessToken: 'student-token',
  tokenType: 'Bearer',
  expiresAt: '2026-08-25T10:00:00.000Z',
  user: {
    id: 101,
    displayName: '林晓雨',
    role: 'STUDENT',
    campusId: 1,
    campusName: '滨江校区',
  },
}

test('学生登录保存令牌并只发送公共登录字段', async () => {
  const storage = memoryStorage()
  const { calls, transport } = responseTransport(() => ({ status: 200, data: studentLogin }))
  const client = createMobileStudentClient({ transport, storage })
  const user = await client.login(' student_101 ', 'K12Pass123!')
  assert.equal(user.role, 'STUDENT')
  assert.equal(storage.get(mobileTokenStorageKey), 'student-token')
  assert.deepEqual(calls[0]?.data, { username: 'student_101', password: 'K12Pass123!' })
})

test('其他角色登录会撤销会话并拒绝进入', async () => {
  const storage = memoryStorage()
  const teacherLogin: LoginResponse = {
    ...studentLogin,
    accessToken: 'teacher-token',
    user: { ...studentLogin.user, id: 301, role: 'TEACHER' },
  }
  const { calls, transport } = responseTransport((input) =>
    input.path === '/auth/login'
      ? { status: 200, data: teacherLogin }
      : { status: 204, data: null },
  )
  const client = createMobileStudentClient({ transport, storage })
  await assert.rejects(() => client.login('teacher_301', 'K12Pass123!'), /不能进入/)
  assert.equal(storage.get(mobileTokenStorageKey), null)
  assert.equal(calls[1]?.path, '/auth/logout')
})

test('概览请求携带 Bearer 令牌且 401 会清理会话', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'expired')
  const { calls, transport } = responseTransport(() => ({
    status: 401,
    data: { code: 'INVALID_SESSION', message: '登录已失效，请重新登录' },
  }))
  const client = createMobileStudentClient({ transport, storage })
  await assert.rejects(
    () => client.getOverview(),
    (error: unknown) => error instanceof MobileClientError && error.status === 401,
  )
  assert.equal(calls[0]?.headers?.Authorization, 'Bearer expired')
  assert.equal(storage.get(mobileTokenStorageKey), null)
})

test('附件上传使用原 MIME 和 base64 传输标识', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'student-token')
  const { calls, transport } = responseTransport(() => ({
    status: 201,
    data: {
      id: 10001,
      originalName: '作业照片.jpg',
      mimeType: 'image/jpeg',
      byteSize: 3,
      createdAt: '2026-08-25T02:00:00.000Z',
    },
  }))
  const client = createMobileStudentClient({ transport, storage })
  await client.uploadFile({
    name: '作业照片.jpg',
    mimeType: 'image/jpeg',
    byteSize: 3,
    base64: 'YWJj',
  })
  assert.equal(calls[0]?.headers?.['Content-Transfer-Encoding'], 'base64')
  assert.equal(calls[0]?.data, 'YWJj')
})

test('提交失败透出服务端业务错误且不会显示假结果', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'student-token')
  const { transport } = responseTransport(() => ({
    status: 409,
    data: { code: 'CONFLICT', message: '当前作业已提交，不能重复提交' },
  }))
  const client = createMobileStudentClient({ transport, storage })
  await assert.rejects(
    () => client.submitWork({ assignmentId: 3001, content: '重复', attachments: [] }),
    /不能重复提交/,
  )
})

test('下载使用登录令牌并返回端侧临时文件', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'student-token')
  let receivedHeaders: Record<string, string> = {}
  const transport: MobileTransport = {
    async request<T>() { return { status: 200, data: {} as T } },
    async download(_path, headers) {
      receivedHeaders = headers
      return { status: 200, tempFilePath: '/tmp/courseware.pdf' }
    },
  }
  const client = createMobileStudentClient({ transport, storage })
  assert.equal(await client.downloadFile(10001), '/tmp/courseware.pdf')
  assert.equal(receivedHeaders.Authorization, 'Bearer student-token')
})

test('空令牌不发送概览请求', async () => {
  const storage = memoryStorage()
  const { calls, transport } = responseTransport(() => ({
    status: 200,
    data: {} as StudentOverview,
  }))
  const client = createMobileStudentClient({ transport, storage })
  await assert.rejects(() => client.getOverview(), /请重新登录/)
  assert.equal(calls.length, 0)
})

test('有效会话恢复当前学生且退出后清理本地令牌', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'student-token')
  const { calls, transport } = responseTransport((input) => {
    if (input.path === '/auth/me') return { status: 200, data: { user: studentLogin.user } }
    return { status: 204, data: null }
  })
  const client = createMobileStudentClient({ transport, storage })
  assert.equal((await client.restoreCurrentUser())?.id, 101)
  await client.logout()
  assert.deepEqual(calls.map((item) => item.path), ['/auth/me', '/auth/logout'])
  assert.equal(storage.get(mobileTokenStorageKey), null)
})

for (const status of [403, 409, 422]) {
  test(`业务错误 ${status} 保留登录并显示服务端中文原因`, async () => {
    const storage = memoryStorage()
    storage.set(mobileTokenStorageKey, 'student-token')
    const { transport } = responseTransport(() => ({
      status,
      data: { code: 'BUSINESS_ERROR', message: `业务规则错误 ${status}` },
    }))
    const client = createMobileStudentClient({ transport, storage })
    await assert.rejects(() => client.getOverview(), new RegExp(String(status)))
    assert.equal(storage.get(mobileTokenStorageKey), 'student-token')
  })
}

test('网络异常归类为中文网络错误并保留登录', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'student-token')
  const transport: MobileTransport = {
    async request() { throw new TypeError('offline') },
    async download() { throw new TypeError('offline') },
  }
  const client = createMobileStudentClient({ transport, storage })
  await assert.rejects(
    () => client.getOverview(),
    (error: unknown) =>
      error instanceof MobileClientError &&
      error.code === 'NETWORK_ERROR' &&
      /网络连接失败/.test(error.message),
  )
  assert.equal(storage.get(mobileTokenStorageKey), 'student-token')
})

test('下载失败不会返回不存在的临时文件', async () => {
  const storage = memoryStorage()
  storage.set(mobileTokenStorageKey, 'student-token')
  const transport: MobileTransport = {
    async request<T>() { return { status: 200, data: {} as T } },
    async download() { return { status: 500, tempFilePath: '' } },
  }
  const client = createMobileStudentClient({ transport, storage })
  await assert.rejects(() => client.downloadFile(10001), /下载失败/)
})
