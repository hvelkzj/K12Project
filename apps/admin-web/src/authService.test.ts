import assert from 'node:assert/strict'
import test from 'node:test'
import type { UserSummary } from '@k12/shared'

import {
  ACCESS_TOKEN_KEY,
  canAccessAdminPage,
  createAuthClient,
  getAdminActorId,
  isAuthenticatedAdmin,
} from './authService'

interface FetchCall {
  url: string
  init?: RequestInit
}

function createFetchMock(
  handler: (
    url: string,
    init?: RequestInit,
    calls?: FetchCall[],
  ) => Response,
) {
  const calls: FetchCall[] = []

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    calls.push({ url, init })
    return handler(url, init, calls)
  }

  return { fetchImpl, calls }
}

function createMemoryStorage() {
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
    values,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const academicUser = {
  id: 901,
  displayName: '许教务',
  role: 'ACADEMIC_ADMIN',
  campusId: 1,
  campusName: '滨江校区',
} satisfies UserSummary

const adminUser = {
  id: 999,
  displayName: '系统管理员',
  role: 'SYSTEM_ADMIN',
  campusId: 1,
  campusName: '滨江校区',
} satisfies UserSummary

test('后台权限只接受已认证管理员并保留真实用户 ID', () => {
  const anotherAcademicUser = {
    ...academicUser,
    id: 912,
    displayName: '另一位教务',
  }

  assert.equal(isAuthenticatedAdmin(null), false)
  assert.equal(
    isAuthenticatedAdmin({ ...academicUser, role: 'PARENT' }),
    false,
  )
  assert.equal(isAuthenticatedAdmin(anotherAcademicUser), true)
  assert.equal(canAccessAdminPage('login', null), true)
  assert.equal(canAccessAdminPage('dashboard', null), false)
  assert.equal(
    canAccessAdminPage('dashboard', { ...academicUser, role: 'PARENT' }),
    false,
  )
  assert.equal(canAccessAdminPage('dashboard', anotherAcademicUser), true)
  assert.equal(getAdminActorId(anotherAcademicUser), 912)
  assert.throws(
    () => getAdminActorId(null),
    /请先使用教务或系统管理员账号登录/,
  )
})

test('两种管理员都能使用真实登录接口登录并保存令牌', async () => {
  const storage = createMemoryStorage()
  const { fetchImpl, calls } = createFetchMock((url) => {
    assert.equal(url, 'http://api.test/auth/login')
    return jsonResponse(200, {
      accessToken: 'token-academic',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T18:00:00+08:00',
      user: academicUser,
    })
  })

  const client = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  const session = await client.login('academic_901', 'K12Demo123!')

  assert.equal(session.user.role, 'ACADEMIC_ADMIN')
  assert.equal(session.accessToken, 'token-academic')
  assert.equal(storage.getItem(ACCESS_TOKEN_KEY), 'token-academic')
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    username: 'academic_901',
    password: 'K12Demo123!',
  })

  const adminStorage = createMemoryStorage()
  const adminFetch = createFetchMock((url) => {
    assert.equal(url, 'http://api.test/auth/login')
    return jsonResponse(200, {
      accessToken: 'token-admin',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T18:00:00+08:00',
      user: adminUser,
    })
  })

  const adminClient = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl: adminFetch.fetchImpl,
    storage: adminStorage,
  })

  const adminSession = await adminClient.login('system_999', 'K12Demo123!')
  assert.equal(adminSession.user.role, 'SYSTEM_ADMIN')
  assert.equal(adminStorage.getItem(ACCESS_TOKEN_KEY), 'token-admin')
})

test('登录失败会抛出服务端错误', async () => {
  const storage = createMemoryStorage()
  const { fetchImpl } = createFetchMock(() =>
    jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: '账号或密码错误' }),
  )

  const client = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await assert.rejects(
    client.login('academic_901', 'wrong'),
    /账号或密码错误/,
  )
  assert.equal(storage.getItem(ACCESS_TOKEN_KEY), null)
})

test('当前用户接口使用已保存令牌，无令牌时返回 null', async () => {
  const storage = createMemoryStorage()
  storage.setItem(ACCESS_TOKEN_KEY, 'token-academic')

  const { fetchImpl, calls } = createFetchMock((url, init) => {
    assert.equal(url, 'http://api.test/auth/me')
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer token-academic',
    )
    return jsonResponse(200, { user: academicUser })
  })

  const client = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  const user = await client.getCurrentUser()
  assert.equal(user?.role, 'ACADEMIC_ADMIN')
  assert.equal(calls.length, 1)

  const emptyStorage = createMemoryStorage()
  const emptyClient = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage: emptyStorage,
  })
  assert.equal(await emptyClient.getCurrentUser(), null)
})

test('令牌过期时清除令牌并返回 null', async () => {
  const storage = createMemoryStorage()
  storage.setItem(ACCESS_TOKEN_KEY, 'expired-token')

  const { fetchImpl } = createFetchMock(() =>
    jsonResponse(401, { code: 'INVALID_SESSION', message: '登录已失效，请重新登录' }),
  )

  const client = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  const user = await client.getCurrentUser()

  assert.equal(user, null)
  assert.equal(storage.getItem(ACCESS_TOKEN_KEY), null)
})

test('退出后清除本地令牌', async () => {
  const storage = createMemoryStorage()
  storage.setItem(ACCESS_TOKEN_KEY, 'token-academic')

  const { fetchImpl, calls } = createFetchMock((url, init) => {
    assert.equal(url, 'http://api.test/auth/logout')
    assert.equal(init?.method, 'POST')
    return new Response(null, { status: 204 })
  })

  const client = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await client.logout()
  assert.equal(storage.getItem(ACCESS_TOKEN_KEY), null)
  assert.equal(calls.length, 1)
})

test('没有令牌时退出不做请求', async () => {
  const storage = createMemoryStorage()
  const { fetchImpl, calls } = createFetchMock(() => new Response(null, { status: 204 }))

  const client = createAuthClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await client.logout()
  assert.equal(calls.length, 0)
})
