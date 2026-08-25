import assert from 'node:assert/strict'
import test from 'node:test'
import type { LoginResponse, UserSummary } from '@k12/shared'

import {
  ACCESS_TOKEN_STORAGE_KEY,
  createTeacherAuthClient,
} from './authClient'

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

function user(role: UserSummary['role'], id: number): UserSummary {
  return {
    id,
    displayName: `用户 ${id}`,
    role,
    campusId: 1,
    campusName: '滨江校区',
  }
}

function loginResponse(currentUser: UserSummary, token: string): LoginResponse {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresAt: '2026-08-19T17:00:00+08:00',
    user: currentUser,
  }
}

test('任课教师和班主任通过真实登录接口并保存统一 token', async (context) => {
  for (const account of [
    { username: 'teacher_301', role: 'TEACHER' as const, id: 301 },
    {
      username: 'teacher_302',
      role: 'HOMEROOM_TEACHER' as const,
      id: 302,
    },
  ]) {
    await context.test(account.role, async () => {
      const storage = createStorage()
      const client = createTeacherAuthClient({
        apiBaseUrl: 'http://api.test/',
        storage,
        fetchImpl: async (url, init) => {
          assert.equal(url, 'http://api.test/auth/login')
          assert.equal(init?.method, 'POST')
          assert.deepEqual(JSON.parse(String(init?.body)), {
            username: account.username,
            password: 'K12Demo123!',
          })
          return jsonResponse(
            loginResponse(user(account.role, account.id), `token-${account.id}`),
          )
        },
      })

      const currentUser = await client.login(
        account.username,
        'K12Demo123!',
      )

      assert.equal(currentUser.role, account.role)
      assert.equal(
        storage.getItem(ACCESS_TOKEN_STORAGE_KEY),
        `token-${account.id}`,
      )
    })
  }
})

test('其他四种角色被拒绝并撤销刚创建的服务端会话', async (context) => {
  for (const account of [
    { role: 'PARENT' as const, id: 201 },
    { role: 'STUDENT' as const, id: 101 },
    { role: 'ACADEMIC_ADMIN' as const, id: 901 },
    { role: 'SYSTEM_ADMIN' as const, id: 999 },
  ]) {
    await context.test(account.role, async () => {
      const storage = createStorage()
      const calls: string[] = []
      const client = createTeacherAuthClient({
        apiBaseUrl: 'http://api.test',
        storage,
        fetchImpl: async (url, init) => {
          calls.push(String(url))
          if (String(url).endsWith('/auth/login')) {
            return jsonResponse(
              loginResponse(user(account.role, account.id), `token-${account.id}`),
            )
          }
          assert.equal(init?.method, 'POST')
          assert.equal(
            new Headers(init?.headers).get('Authorization'),
            `Bearer token-${account.id}`,
          )
          return new Response(null, { status: 204 })
        },
      })

      await assert.rejects(
        () => client.login(`account_${account.id}`, 'K12Demo123!'),
        /不是教师或班主任角色/,
      )
      assert.deepEqual(calls, [
        'http://api.test/auth/login',
        'http://api.test/auth/logout',
      ])
      assert.equal(storage.getItem(ACCESS_TOKEN_STORAGE_KEY), null)
    })
  }
})

test('错误凭据显示服务端消息且不保存 token', async () => {
  const storage = createStorage()
  const client = createTeacherAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async () =>
      jsonResponse({ code: 'INVALID_CREDENTIALS', message: '账号或密码错误' }, 401),
  })

  await assert.rejects(
    () => client.login('teacher_301', 'wrong'),
    /账号或密码错误/,
  )
  assert.equal(storage.getItem(ACCESS_TOKEN_STORAGE_KEY), null)
})

test('有效 token 通过当前用户接口恢复教师会话', async () => {
  const storage = createStorage()
  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-301')
  const client = createTeacherAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/auth/me')
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer token-301',
      )
      return jsonResponse({ user: user('TEACHER', 301) })
    },
  })

  assert.equal((await client.restoreCurrentUser())?.id, 301)
})

test('过期 token 被清除并返回未登录状态', async () => {
  const storage = createStorage()
  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'expired-token')
  const client = createTeacherAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async () =>
      jsonResponse({ code: 'INVALID_SESSION', message: '登录已失效' }, 401),
  })

  assert.equal(await client.restoreCurrentUser(), null)
  assert.equal(storage.getItem(ACCESS_TOKEN_STORAGE_KEY), null)
})

test('恢复到非教师会话时撤销会话并清除 token', async () => {
  const storage = createStorage()
  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-201')
  const calls: string[] = []
  const client = createTeacherAuthClient({
    apiBaseUrl: 'http://api.test',
    storage,
    fetchImpl: async (url) => {
      calls.push(String(url))
      return String(url).endsWith('/auth/me')
        ? jsonResponse({ user: user('PARENT', 201) })
        : new Response(null, { status: 204 })
    },
  })

  await assert.rejects(
    () => client.restoreCurrentUser(),
    /不是教师或班主任角色/,
  )
  assert.deepEqual(calls, [
    'http://api.test/auth/me',
    'http://api.test/auth/logout',
  ])
  assert.equal(storage.getItem(ACCESS_TOKEN_STORAGE_KEY), null)
})

test('退出调用真实接口，接口失败时也清除本地 token', async (context) => {
  for (const scenario of [
    {
      name: '正常退出',
      response: new Response(null, { status: 204 }),
      error: null,
    },
    {
      name: '服务端失败',
      response: jsonResponse({ code: 'INTERNAL_ERROR', message: '服务异常' }, 500),
      error: /服务异常/,
    },
  ]) {
    await context.test(scenario.name, async () => {
      const storage = createStorage()
      storage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-301')
      const client = createTeacherAuthClient({
        apiBaseUrl: 'http://api.test',
        storage,
        fetchImpl: async (url, init) => {
          assert.equal(url, 'http://api.test/auth/logout')
          assert.equal(init?.method, 'POST')
          return scenario.response
        },
      })

      if (scenario.error) {
        await assert.rejects(() => client.logout(), scenario.error)
      } else {
        await client.logout()
      }
      assert.equal(storage.getItem(ACCESS_TOKEN_STORAGE_KEY), null)
    })
  }
})
