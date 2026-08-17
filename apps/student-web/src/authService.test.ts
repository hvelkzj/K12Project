import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoginResponse, UserSummary } from '@k12/shared'

import {
  accessTokenStorageKey,
  createStudentAuthClient,
} from './services/authService'

interface FetchCall {
  url: string
  init?: RequestInit
}

function createStorage() {
  const values = new Map<string, string>()

  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }
}

function createFetchMock(
  handler: (url: string, init?: RequestInit, calls?: FetchCall[]) => Response,
) {
  const calls: FetchCall[] = []
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    return handler(url, init, calls)
  }

  return { fetchImpl, calls }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const studentUser = {
  id: 101,
  displayName: '林晓雨',
  role: 'STUDENT',
  campusId: 1,
  campusName: '滨江校区',
} satisfies UserSummary

const parentUser = {
  id: 201,
  displayName: '林女士',
  role: 'PARENT',
  campusId: 1,
  campusName: '滨江校区',
} satisfies UserSummary

function loginResponse(user: UserSummary, accessToken = 'token-101'): LoginResponse {
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresAt: '2026-08-17T20:00:00.000Z',
    user,
  }
}

test('正确学生账号登录后保存访问令牌', async () => {
  const storage = createStorage()
  const { fetchImpl, calls } = createFetchMock((url) => {
    assert.equal(url, 'http://api.test/auth/login')
    return jsonResponse(loginResponse(studentUser))
  })
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test/',
    fetchImpl,
    storage,
  })

  const user = await client.login('student_101', 'K12Demo123!')

  assert.equal(user.id, 101)
  assert.equal(storage.getItem(accessTokenStorageKey), 'token-101')
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    username: 'student_101',
    password: 'K12Demo123!',
  })
})

test('错误密码保留服务端凭证错误提示且不保存令牌', async () => {
  const storage = createStorage()
  const { fetchImpl } = createFetchMock(() =>
    jsonResponse(
      { code: 'INVALID_CREDENTIALS', message: '账号或密码错误' },
      401,
    ),
  )
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await assert.rejects(
    () => client.login('student_101', 'wrong-password'),
    /账号或密码错误/,
  )
  assert.equal(storage.getItem(accessTokenStorageKey), null)
})

test('非学生账号会被拒绝并撤销刚创建的服务端会话', async () => {
  const storage = createStorage()
  const { fetchImpl, calls } = createFetchMock((url, init) => {
    if (url.endsWith('/auth/login')) {
      return jsonResponse(loginResponse(parentUser, 'token-parent'))
    }

    assert.equal(url, 'http://api.test/auth/logout')
    assert.equal(init?.method, 'POST')
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer token-parent',
    )
    return new Response(null, { status: 204 })
  })
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await assert.rejects(
    () => client.login('parent_201', 'K12Demo123!'),
    /非学生角色不能进入此端/,
  )
  assert.equal(calls.length, 2)
  assert.equal(storage.getItem(accessTokenStorageKey), null)
})

test('已有有效令牌时通过当前用户接口恢复学生会话', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'token-101')
  const { fetchImpl } = createFetchMock((url, init) => {
    assert.equal(url, 'http://api.test/auth/me')
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer token-101',
    )
    return jsonResponse({ user: studentUser })
  })
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  assert.deepEqual(await client.restoreCurrentUser(), studentUser)
  assert.equal(client.getAccessToken(), 'token-101')
})

test('令牌过期时清除本地令牌并返回未登录状态', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'expired-token')
  const { fetchImpl } = createFetchMock(() =>
    jsonResponse(
      { code: 'INVALID_SESSION', message: '登录已失效，请重新登录' },
      401,
    ),
  )
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  assert.equal(await client.restoreCurrentUser(), null)
  assert.equal(client.getAccessToken(), null)
})

test('恢复会话遇到服务异常时保留令牌并报告错误', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'token-101')
  const { fetchImpl } = createFetchMock(() =>
    jsonResponse({ code: 'INTERNAL_ERROR', message: '服务异常' }, 500),
  )
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await assert.rejects(() => client.restoreCurrentUser(), /服务异常/)
  assert.equal(client.getAccessToken(), 'token-101')
})

test('当前用户不是学生时清除令牌并拒绝恢复会话', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'token-parent')
  const { fetchImpl } = createFetchMock(() =>
    jsonResponse({ user: parentUser }),
  )
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await assert.rejects(
    () => client.restoreCurrentUser(),
    /非学生角色不能进入此端/,
  )
  assert.equal(client.getAccessToken(), null)
})

test('退出登录调用服务端并清除本地令牌', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'token-101')
  const { fetchImpl, calls } = createFetchMock((url, init) => {
    assert.equal(url, 'http://api.test/auth/logout')
    assert.equal(init?.method, 'POST')
    return new Response(null, { status: 204 })
  })
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await client.logout()
  assert.equal(calls.length, 1)
  assert.equal(client.getAccessToken(), null)
})

test('退出接口失败时报告错误但仍清除本地令牌', async (context) => {
  for (const scenario of [
    {
      name: '服务端返回 500',
      fetchImpl: async () =>
        jsonResponse({ code: 'INTERNAL_ERROR', message: '服务异常' }, 500),
      expectedError: /服务异常/,
    },
    {
      name: '网络请求失败',
      fetchImpl: async () => {
        throw new TypeError('network unavailable')
      },
      expectedError: /network unavailable/,
    },
  ]) {
    await context.test(scenario.name, async () => {
      const storage = createStorage()
      storage.setItem(accessTokenStorageKey, 'token-101')
      const client = createStudentAuthClient({
        apiBaseUrl: 'http://api.test',
        fetchImpl: scenario.fetchImpl,
        storage,
      })

      await assert.rejects(() => client.logout(), scenario.expectedError)
      assert.equal(client.getAccessToken(), null)
    })
  }
})

test('没有本地令牌时退出不会发送请求', async () => {
  const storage = createStorage()
  const { fetchImpl, calls } = createFetchMock(() =>
    new Response(null, { status: 204 }),
  )
  const client = createStudentAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await client.logout()
  assert.equal(calls.length, 0)
})
