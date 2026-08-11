import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoginResponse, UserSummary } from '@k12/shared'
import { createParentAuthClient, accessTokenStorageKey } from './authClient'

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const parentUser: UserSummary = {
  id: 201,
  displayName: '林女士',
  role: 'PARENT',
  campusId: 1,
  campusName: '滨江校区',
}

const teacherUser: UserSummary = {
  id: 301,
  displayName: '李老师',
  role: 'TEACHER',
  campusId: 1,
  campusName: '滨江校区',
}

function loginResponse(user: UserSummary): LoginResponse {
  return {
    accessToken: 'token-201',
    tokenType: 'Bearer',
    expiresAt: '2026-08-11T12:00:00.000Z',
    user,
  }
}

test('正确家长账号登录后写入 sessionStorage token', async () => {
  const storage = createStorage()
  const client = createParentAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/auth/login')
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init?.body)), {
        username: 'parent_201',
        password: 'K12Demo123!',
      })
      return jsonResponse(loginResponse(parentUser))
    },
  })

  const user = await client.login('parent_201', 'K12Demo123!')

  assert.equal(user.role, 'PARENT')
  assert.equal(storage.getItem(accessTokenStorageKey), 'token-201')
})

test('错误账号或密码不能登录且不写入 token', async () => {
  const storage = createStorage()
  const client = createParentAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async () =>
      jsonResponse({ code: 'INVALID_CREDENTIALS', message: '账号或密码错误' }, 401),
  })

  await assert.rejects(
    () => client.login('parent_201', 'wrong-password'),
    /账号或密码错误/,
  )
  assert.equal(storage.getItem(accessTokenStorageKey), null)
})

test('非家长角色登录会被阻止', async () => {
  const storage = createStorage()
  const client = createParentAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async () => jsonResponse(loginResponse(teacherUser)),
  })

  await assert.rejects(
    () => client.login('teacher_301', 'K12Demo123!'),
    /当前账号不是家长角色/,
  )
  assert.equal(storage.getItem(accessTokenStorageKey), null)
})

test('页面刷新时 token 有效会通过 /auth/me 恢复家长', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'token-201')
  const client = createParentAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/auth/me')
      assert.deepEqual(init?.headers, {
        Authorization: 'Bearer token-201',
      })
      return jsonResponse({ user: parentUser })
    },
  })

  const user = await client.restoreCurrentUser()

  assert.equal(user?.id, 201)
})

test('token 无效时清理 token 并返回登录页状态', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'expired-token')
  const client = createParentAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async () =>
      jsonResponse({ code: 'INVALID_SESSION', message: '登录已失效，请重新登录' }, 401),
  })

  const user = await client.restoreCurrentUser()

  assert.equal(user, null)
  assert.equal(storage.getItem(accessTokenStorageKey), null)
})

test('退出登录会调用 /auth/logout 并阻止继续访问', async () => {
  const storage = createStorage()
  storage.setItem(accessTokenStorageKey, 'token-201')
  let logoutCalled = false
  const client = createParentAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async (url, init) => {
      logoutCalled = true
      assert.equal(url, 'http://api.test/auth/logout')
      assert.deepEqual(init?.headers, {
        Authorization: 'Bearer token-201',
      })
      return new Response(null, { status: 204 })
    },
  })

  await client.logout()

  assert.equal(logoutCalled, true)
  assert.equal(client.getAccessToken(), null)
  assert.equal(await client.restoreCurrentUser(), null)
})
