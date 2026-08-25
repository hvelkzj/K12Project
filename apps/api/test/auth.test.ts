import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ApiError,
  CurrentUserResponse,
  LoginResponse,
} from '@k12/shared'
import {
  MOCK_ACCOUNTS,
  MOCK_ACCOUNT_PASSWORD,
} from '@k12/shared/mock-accounts'

import { createRequestHandler } from '../src/app.js'
import { createAuthService } from '../src/authService.js'
import { callHandler, parseJsonBody } from './httpTestUtils.js'

const fixedNow = Date.parse('2026-08-07T10:00:00+08:00')

function setup(options: { now?: () => number } = {}) {
  let tokenNumber = 0
  const authService = createAuthService({
    now: options.now ?? (() => fixedNow),
    createToken: () => `test-token-${++tokenNumber}`,
  })

  return {
    authService,
    handler: createRequestHandler(authService),
  }
}

async function login(
  handler: ReturnType<typeof createRequestHandler>,
  username = 'student_101',
  password = MOCK_ACCOUNT_PASSWORD,
): Promise<LoginResponse> {
  const response = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: { username, password },
  })

  assert.equal(response.status, 200)
  return parseJsonBody<LoginResponse>(response)
}

test('全部本地账号均可登录并覆盖六种角色', async () => {
  const { handler } = setup()

  for (const account of MOCK_ACCOUNTS) {
    const response = await callHandler(handler, {
      method: 'POST',
      url: '/auth/login',
      jsonBody: {
        username: account.username,
        password: account.password,
      },
    })
    const body = parseJsonBody<LoginResponse>(response)

    assert.equal(response.status, 200)
    assert.equal(body.tokenType, 'Bearer')
    assert.equal(body.user.id, account.user.id)
    assert.equal(body.user.role, account.user.role)
    assert.equal(body.user.campusId, account.user.campusId)
    assert.equal('password' in body.user, false)
  }
})

test('错误账号或密码统一返回 INVALID_CREDENTIALS', async () => {
  const { handler } = setup()

  for (const jsonBody of [
    { username: 'student_101', password: 'wrong-password' },
    { username: 'unknown', password: MOCK_ACCOUNT_PASSWORD },
  ]) {
    const response = await callHandler(handler, {
      method: 'POST',
      url: '/auth/login',
      jsonBody,
    })

    assert.equal(response.status, 401)
    assert.equal(
      parseJsonBody<ApiError>(response).code,
      'INVALID_CREDENTIALS',
    )
  }
})

test('登录接口校验媒体类型、JSON 和必填字段', async () => {
  const { handler } = setup()
  const caseInsensitiveJson = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: {
      username: 'student_101',
      password: MOCK_ACCOUNT_PASSWORD,
    },
    contentType: 'Application/JSON; Charset=UTF-8',
  })
  const unsupported = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    rawBody: '{}',
    contentType: 'text/plain',
  })
  const invalidJson = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    rawBody: '{invalid',
  })
  const invalidFields = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: { username: '', password: 123 },
  })

  assert.equal(caseInsensitiveJson.status, 200)
  assert.equal(
    caseInsensitiveJson.headers.get('cache-control'),
    'no-store',
  )
  assert.equal(unsupported.status, 415)
  assert.equal(
    parseJsonBody<ApiError>(unsupported).code,
    'UNSUPPORTED_MEDIA_TYPE',
  )
  assert.equal(invalidJson.status, 400)
  assert.equal(parseJsonBody<ApiError>(invalidJson).code, 'INVALID_JSON')
  assert.equal(invalidFields.status, 400)
  assert.equal(
    parseJsonBody<ApiError>(invalidFields).code,
    'VALIDATION_ERROR',
  )
})

test('有效令牌可以查询当前用户，退出后立即失效', async () => {
  const { handler } = setup()
  const session = await login(handler)
  const headers = {
    authorization: `bearer ${session.accessToken}`,
  }
  const current = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers,
  })
  const logout = await callHandler(handler, {
    method: 'POST',
    url: '/auth/logout',
    headers,
  })
  const afterLogout = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers,
  })

  assert.equal(current.status, 200)
  assert.equal(
    parseJsonBody<CurrentUserResponse>(current).user.role,
    'STUDENT',
  )
  assert.equal(current.headers.get('cache-control'), 'no-store')
  assert.equal(logout.status, 204)
  assert.equal(logout.body, '')
  assert.equal(afterLogout.status, 401)
  assert.equal(
    parseJsonBody<ApiError>(afterLogout).code,
    'INVALID_SESSION',
  )
})

test('缺少、格式错误或未知令牌不能访问当前用户', async () => {
  const { handler } = setup()

  const missing = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
  })
  const malformed = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Basic abc' },
  })
  const unknown = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Bearer unknown-token' },
  })

  assert.equal(parseJsonBody<ApiError>(missing).code, 'AUTH_REQUIRED')
  assert.equal(missing.status, 401)
  assert.equal(
    missing.headers.get('www-authenticate'),
    'Bearer realm="k12-api"',
  )
  assert.equal(parseJsonBody<ApiError>(malformed).code, 'AUTH_REQUIRED')
  assert.equal(malformed.status, 401)
  assert.equal(parseJsonBody<ApiError>(unknown).code, 'INVALID_SESSION')
  assert.equal(unknown.status, 401)
  assert.equal(
    unknown.headers.get('www-authenticate'),
    'Bearer realm="k12-api"',
  )
})

test('超过八小时的会话不能查询当前用户或退出', async () => {
  let now = fixedNow
  const { handler } = setup({ now: () => now })
  const currentSession = await login(handler)
  const logoutSession = await login(handler)

  now += 8 * 60 * 60 * 1000
  const current = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: {
      authorization: `Bearer ${currentSession.accessToken}`,
    },
  })
  const logout = await callHandler(handler, {
    method: 'POST',
    url: '/auth/logout',
    headers: {
      authorization: `Bearer ${logoutSession.accessToken}`,
    },
  })

  assert.equal(current.status, 401)
  assert.equal(parseJsonBody<ApiError>(current).code, 'INVALID_SESSION')
  assert.equal(logout.status, 401)
  assert.equal(parseJsonBody<ApiError>(logout).code, 'INVALID_SESSION')
})

test('同一账号的多个会话互不影响，未知或重复退出会失败', async () => {
  const { handler } = setup()
  const first = await login(handler)
  const second = await login(handler)
  const firstHeaders = {
    authorization: `Bearer ${first.accessToken}`,
  }

  const firstLogout = await callHandler(handler, {
    method: 'POST',
    url: '/auth/logout',
    headers: firstHeaders,
  })
  const secondCurrent = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: {
      authorization: `Bearer ${second.accessToken}`,
    },
  })
  const repeatedLogout = await callHandler(handler, {
    method: 'POST',
    url: '/auth/logout',
    headers: firstHeaders,
  })
  const unknownLogout = await callHandler(handler, {
    method: 'POST',
    url: '/auth/logout',
    headers: { authorization: 'Bearer unknown-token' },
  })

  assert.equal(firstLogout.status, 204)
  assert.equal(secondCurrent.status, 200)
  assert.equal(repeatedLogout.status, 401)
  assert.equal(
    parseJsonBody<ApiError>(repeatedLogout).code,
    'INVALID_SESSION',
  )
  assert.equal(unknownLogout.status, 401)
  assert.equal(
    parseJsonBody<ApiError>(unknownLogout).code,
    'INVALID_SESSION',
  )
})

test('每个账号最多保留五个会话且不会驱逐其他账号', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')
  const studentSessions: LoginResponse[] = []

  for (let index = 0; index < 6; index += 1) {
    studentSessions.push(await login(handler))
  }

  const oldestStudent = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: {
      authorization: `Bearer ${studentSessions[0]?.accessToken}`,
    },
  })
  const newestStudent = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: {
      authorization: `Bearer ${studentSessions.at(-1)?.accessToken}`,
    },
  })
  const parentCurrent = await callHandler(handler, {
    method: 'GET',
    url: '/auth/me',
    headers: {
      authorization: `Bearer ${parent.accessToken}`,
    },
  })

  assert.equal(oldestStudent.status, 401)
  assert.equal(newestStudent.status, 200)
  assert.equal(parentCurrent.status, 200)
  assert.equal(
    parseJsonBody<CurrentUserResponse>(parentCurrent).user.role,
    'PARENT',
  )
})

test('预检、方法限制和请求体大小边界明确', async () => {
  const { handler } = setup()
  const bodyPrefix = '{"username":"student_101","password":"'
  const bodySuffix = '"}'
  const boundaryBody = `${bodyPrefix}${'x'.repeat(
    16 * 1024 - Buffer.byteLength(bodyPrefix) - Buffer.byteLength(bodySuffix),
  )}${bodySuffix}`
  const preflight = await callHandler(handler, {
    method: 'OPTIONS',
    url: '/auth/login',
  })
  const wrongMethod = await callHandler(handler, {
    method: 'GET',
    url: '/auth/login',
  })
  const tooLarge = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    rawChunks: [boundaryBody.slice(0, 8 * 1024), boundaryBody.slice(8 * 1024), ' '],
  })
  const exactBoundary = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    rawChunks: [boundaryBody.slice(0, 8 * 1024), boundaryBody.slice(8 * 1024)],
  })

  assert.equal(Buffer.byteLength(boundaryBody), 16 * 1024)
  assert.equal(preflight.status, 204)
  assert.equal(
    preflight.headers.get('access-control-allow-headers'),
    'Content-Type, Authorization, Content-Transfer-Encoding',
  )
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.headers.get('allow'), 'POST, OPTIONS')
  assert.equal(exactBoundary.status, 401)
  assert.equal(
    parseJsonBody<ApiError>(exactBoundary).code,
    'INVALID_CREDENTIALS',
  )
  assert.equal(tooLarge.status, 413)
  assert.equal(
    parseJsonBody<ApiError>(tooLarge).code,
    'PAYLOAD_TOO_LARGE',
  )
})
