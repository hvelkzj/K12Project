import assert from 'node:assert/strict'
import test from 'node:test'

import type { RegisterRequest, RegisterResponse } from '@k12/shared'

import { createRegistrationClient } from './registrationClient'

const request: RegisterRequest = {
  username: 'student_demo',
  displayName: '演示学生',
  password: 'Study2026',
  role: 'STUDENT',
}

test('注册客户端向统一 API 发送公共字段并返回账号', async () => {
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  const responseBody: RegisterResponse = {
    user: {
      id: 1001,
      username: request.username,
      displayName: request.displayName,
      role: request.role,
      campusId: 1,
      campusName: '滨江校区',
      active: true,
    },
  }
  const client = createRegistrationClient({
    apiBaseUrl: 'http://api.test/',
    fetchImpl: async (url, init) => {
      requestUrl = String(url)
      requestInit = init
      return new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  const account = await client.register(request)

  assert.equal(requestUrl, 'http://api.test/auth/register')
  assert.equal(requestInit?.method, 'POST')
  assert.deepEqual(JSON.parse(String(requestInit?.body)), request)
  assert.equal(account.username, request.username)
  assert.equal('password' in account, false)
})

test('注册客户端显示服务端业务错误且无有效错误体时使用兜底文案', async () => {
  const duplicateClient = createRegistrationClient({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ code: 'USERNAME_TAKEN', message: '用户名已存在' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
  })
  const unavailableClient = createRegistrationClient({
    fetchImpl: async () => new Response('upstream error', { status: 503 }),
  })

  await assert.rejects(
    () => duplicateClient.register(request),
    /用户名已存在/,
  )
  await assert.rejects(
    () => unavailableClient.register(request),
    /注册服务暂时不可用/,
  )
})

test('网络异常不会被显示为注册成功', async () => {
  const client = createRegistrationClient({
    fetchImpl: async () => {
      throw new TypeError('network unavailable')
    },
  })

  await assert.rejects(() => client.register(request), /network unavailable/)
})
