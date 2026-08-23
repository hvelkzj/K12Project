import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ApiError,
  LoginResponse,
  RegisterResponse,
  UserAccountSummary,
} from '@k12/shared'
import { MOCK_ACCOUNT_PASSWORD } from '@k12/shared/mock-accounts'

import { createRequestHandler } from '../src/app.js'
import { createAuthService } from '../src/authService.js'
import { createBusinessStore } from '../src/businessStore.js'
import type { AdminOverview, StudentOverview } from '../src/businessTypes.js'
import { callHandler, parseJsonBody } from './httpTestUtils.js'

const fixedNow = Date.parse('2026-08-24T10:00:00+08:00')

function setup() {
  let tokenNumber = 0
  const authService = createAuthService({
    now: () => fixedNow,
    createToken: () => `registration-token-${++tokenNumber}`,
  })
  const businessStore = createBusinessStore({ now: () => fixedNow })
  return {
    authService,
    businessStore,
    handler: createRequestHandler(authService, businessStore),
  }
}

async function register(
  handler: ReturnType<typeof createRequestHandler>,
  input: Record<string, unknown>,
) {
  return callHandler(handler, {
    method: 'POST',
    url: '/auth/register',
    jsonBody: input,
  })
}

async function login(
  handler: ReturnType<typeof createRequestHandler>,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: { username, password },
  })
  assert.equal(response.status, 200)
  return parseJsonBody<LoginResponse>(response)
}

test('学生注册后可以登录、读取默认班级并出现在后台账号列表', async () => {
  const { handler } = setup()
  const registration = await register(handler, {
    username: 'student_demo',
    displayName: '演示学生',
    password: 'Study2026',
    role: 'STUDENT',
  })
  const registered = parseJsonBody<RegisterResponse>(registration)

  assert.equal(registration.status, 201)
  assert.equal(registration.headers.get('cache-control'), 'no-store')
  assert.equal(registered.user.username, 'student_demo')
  assert.equal(registered.user.role, 'STUDENT')
  assert.equal(registered.user.active, true)
  assert.equal('password' in registered.user, false)

  const studentSession = await login(handler, 'student_demo', 'Study2026')
  const studentOverview = await callHandler(handler, {
    method: 'GET',
    url: '/student/overview',
    headers: {
      authorization: `Bearer ${studentSession.accessToken}`,
    },
  })
  const student = parseJsonBody<StudentOverview>(studentOverview).student
  assert.equal(student.id, registered.user.id)
  assert.equal(student.classId, 101)
  assert.equal(student.className, '六年级 1 班')

  const adminSession = await login(
    handler,
    'system_999',
    MOCK_ACCOUNT_PASSWORD,
  )
  const adminOverview = await callHandler(handler, {
    method: 'GET',
    url: '/admin/overview',
    headers: { authorization: `Bearer ${adminSession.accessToken}` },
  })
  const accounts = parseJsonBody<AdminOverview>(adminOverview).users
  assert.equal(
    accounts.some((account) => account.username === 'student_demo'),
    true,
  )
})

test('家长注册后可以登录且初始绑定学生为空', async () => {
  const { handler } = setup()
  const registration = await register(handler, {
    username: 'parent_demo',
    displayName: '演示家长',
    password: 'Parent2026',
    role: 'PARENT',
  })
  const account = parseJsonBody<RegisterResponse>(registration).user
  const session = await login(handler, 'parent_demo', 'Parent2026')
  const students = await callHandler(handler, {
    method: 'GET',
    url: '/parent/students',
    headers: { authorization: `Bearer ${session.accessToken}` },
  })

  assert.equal(registration.status, 201)
  assert.equal(account.role, 'PARENT')
  assert.deepEqual(parseJsonBody(students), [])
})

test('注册拒绝公共账号、后台保留账号和重复用户名', async () => {
  const { handler } = setup()
  for (const username of ['student_101', 'student_102']) {
    const response = await register(handler, {
      username,
      displayName: '重复账号',
      password: 'Repeat2026',
      role: 'STUDENT',
    })
    assert.equal(response.status, 409)
    assert.equal(parseJsonBody<ApiError>(response).code, 'USERNAME_TAKEN')
  }

  const first = await register(handler, {
    username: 'parent_repeat',
    displayName: '首次注册',
    password: 'Repeat2026',
    role: 'PARENT',
  })
  const repeated = await register(handler, {
    username: 'parent_repeat',
    displayName: '重复注册',
    password: 'Repeat2026',
    role: 'PARENT',
  })
  assert.equal(first.status, 201)
  assert.equal(repeated.status, 409)
})

test('注册校验用户名、姓名、密码、角色和媒体类型', async () => {
  const { handler } = setup()
  const valid = {
    username: 'student_valid',
    displayName: '有效学生',
    password: 'Valid2026',
    role: 'STUDENT',
  }
  const invalidInputs = [
    { ...valid, username: 'Student' },
    { ...valid, displayName: 'A' },
    { ...valid, password: 'onlyletters' },
    { ...valid, role: 'TEACHER' },
    [],
  ]

  for (const input of invalidInputs) {
    const response = await register(handler, input as Record<string, unknown>)
    assert.equal(response.status, 422)
    assert.equal(parseJsonBody<ApiError>(response).code, 'VALIDATION_ERROR')
  }

  const unsupported = await callHandler(handler, {
    method: 'POST',
    url: '/auth/register',
    rawBody: JSON.stringify(valid),
    contentType: 'text/plain',
  })
  assert.equal(unsupported.status, 415)
  assert.equal(
    parseJsonBody<ApiError>(unsupported).code,
    'UNSUPPORTED_MEDIA_TYPE',
  )
})

test('注册接口支持预检并明确方法与 JSON 错误', async () => {
  const { handler } = setup()
  const preflight = await callHandler(handler, {
    method: 'OPTIONS',
    url: '/auth/register',
  })
  const wrongMethod = await callHandler(handler, {
    method: 'GET',
    url: '/auth/register',
  })
  const invalidJson = await callHandler(handler, {
    method: 'POST',
    url: '/auth/register',
    rawBody: '{invalid',
  })

  assert.equal(preflight.status, 204)
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.headers.get('allow'), 'POST, OPTIONS')
  assert.equal(invalidJson.status, 400)
  assert.equal(parseJsonBody<ApiError>(invalidJson).code, 'INVALID_JSON')
})

test('服务重置后移除运行时注册账号', async () => {
  const { authService, businessStore, handler } = setup()
  const response = await register(handler, {
    username: 'student_reset',
    displayName: '重置学生',
    password: 'Reset2026',
    role: 'STUDENT',
  })
  assert.equal(response.status, 201)

  authService.reset()
  businessStore.reset()
  const loginResponse = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: { username: 'student_reset', password: 'Reset2026' },
  })
  assert.equal(loginResponse.status, 401)
})

test('注册账号可以被系统管理员停用并撤销会话', async () => {
  const { handler } = setup()
  const registration = await register(handler, {
    username: 'student_disabled',
    displayName: '停用学生',
    password: 'Disable2026',
    role: 'STUDENT',
  })
  const account = parseJsonBody<RegisterResponse>(registration).user
  const studentSession = await login(handler, 'student_disabled', 'Disable2026')
  const adminSession = await login(
    handler,
    'system_999',
    MOCK_ACCOUNT_PASSWORD,
  )

  const disabled = await callHandler(handler, {
    method: 'PATCH',
    url: `/admin/users/${account.id}`,
    jsonBody: { active: false },
    headers: { authorization: `Bearer ${adminSession.accessToken}` },
  })
  const current = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: `Bearer ${studentSession.accessToken}` },
  })

  assert.equal(disabled.status, 200)
  assert.equal(parseJsonBody<UserAccountSummary>(disabled).active, false)
  assert.equal(current.status, 401)
})
