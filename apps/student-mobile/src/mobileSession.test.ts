import assert from 'node:assert/strict'
import test from 'node:test'

import type { StudentOverview, UserSummary } from '@k12/shared'

import type { MobileStudentClient } from './mobileClient'
import { MobileClientError } from './mobileClient'
import { createMobileSession } from './mobileSession'

const user: UserSummary = {
  id: 101,
  displayName: '林晓雨',
  role: 'STUDENT',
  campusId: 1,
  campusName: '滨江校区',
}

const overview: StudentOverview = {
  student: {
    id: 101,
    displayName: '林晓雨',
    classId: 101,
    className: '六年级 1 班',
    campusId: 1,
    campusName: '滨江校区',
  },
  courses: [],
  teachers: [],
  courseware: [],
  assignments: [],
  submissions: [],
  attendance: [],
}

function fakeClient(overrides: Partial<MobileStudentClient> = {}): MobileStudentClient {
  return {
    getServiceUrl() { return 'http://127.0.0.1:3000' },
    setServiceUrl(value) { return value },
    async checkConnection() {},
    async login() { return user },
    async restoreCurrentUser() { return user },
    async logout() {},
    async getOverview() { return overview },
    async uploadFile() { throw new Error('本测试未使用上传') },
    async downloadFile() { throw new Error('本测试未使用下载') },
    async submitWork() { throw new Error('本测试未使用提交') },
    getAccessToken() { return 'student-token' },
    clearAccessToken() {},
    ...overrides,
  }
}

test('启动恢复会话后立即加载学生概览', async () => {
  const session = createMobileSession(fakeClient())
  await session.restore()
  assert.equal(session.state.initializing, false)
  assert.equal(session.state.user?.id, 101)
  assert.equal(session.state.overview?.student.id, 101)
})

test('概览空数据是成功状态且强制刷新重新请求', async () => {
  let calls = 0
  const session = createMobileSession(fakeClient({
    async getOverview() { calls += 1; return overview },
  }))
  await session.login('student_101', 'K12Demo123!')
  await session.loadOverview()
  await session.loadOverview(true)
  assert.equal(calls, 2)
  assert.equal(session.state.error, '')
})

test('401 清空页面会话，网络错误保留已加载数据以便重试', async () => {
  const expired = createMobileSession(fakeClient({
    async getOverview() {
      throw new MobileClientError('登录已失效，请重新登录', 401, 'INVALID_SESSION')
    },
  }))
  await assert.rejects(() => expired.login('student_101', 'K12Demo123!'))
  assert.equal(expired.state.user, null)
  assert.equal(expired.state.overview, null)

  let fail = false
  const retryable = createMobileSession(fakeClient({
    async getOverview() {
      if (fail) throw new MobileClientError('网络连接失败，请稍后重试', 0, 'NETWORK_ERROR')
      return overview
    },
  }))
  await retryable.login('student_101', 'K12Demo123!')
  fail = true
  await assert.rejects(() => retryable.loadOverview(true))
  assert.equal(retryable.state.overview?.student.id, 101)
  assert.match(retryable.state.error, /网络连接失败/)
})

test('退出无论服务端是否失败都会清空本地页面状态', async () => {
  const session = createMobileSession(fakeClient({
    async logout() { throw new Error('服务暂时不可用') },
  }))
  await session.login('student_101', 'K12Demo123!')
  await assert.rejects(() => session.logout())
  assert.equal(session.state.user, null)
  assert.equal(session.state.overview, null)
})
