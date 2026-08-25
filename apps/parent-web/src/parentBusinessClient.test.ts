import assert from 'node:assert/strict'
import test from 'node:test'
import { createParentBusinessClient, ParentBusinessError } from './parentBusinessClient'
import {
  confirmedFeedback,
  disputedFeedback,
  emptyOverview,
  generalNotice,
  leaveRequest,
  overviewOne,
  overviewTwo,
  parentBindings,
  pendingFeedback,
  scheduleChangeNotice,
} from './parentBusinessFixtures.test'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createAuth(token = 'token-201') {
  let accessToken: string | null = token

  return {
    getAccessToken() {
      return accessToken
    },
    clearAccessToken() {
      accessToken = null
    },
  }
}

test('登录后加载绑定学生和默认学生概览', async () => {
  const calls: string[] = []
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async (url, init) => {
      calls.push(String(url))
      assert.deepEqual(init?.headers, {
        Authorization: 'Bearer token-201',
      })

      if (url === 'http://api.test/parent/students') {
        return jsonResponse(parentBindings)
      }
      return jsonResponse(overviewOne)
    },
  })

  const bindings = await client.listStudents()
  const overview = await client.getOverview(bindings[0]!.student.id)

  assert.deepEqual(calls, [
    'http://api.test/parent/students',
    'http://api.test/parent/students/101/overview',
  ])
  assert.equal(bindings.length, 2)
  assert.equal(overview.student.id, 101)
})

test('切换学生时重新请求对应学生概览且数据不同', async () => {
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async (url) => {
      if (url === 'http://api.test/parent/students/101/overview') {
        return jsonResponse(overviewOne)
      }
      if (url === 'http://api.test/parent/students/102/overview') {
        return jsonResponse(overviewTwo)
      }
      return jsonResponse({ code: 'NOT_FOUND', message: '接口不存在' }, 404)
    },
  })

  const first = await client.getOverview(101)
  const second = await client.getOverview(102)

  assert.equal(first.student.id, 101)
  assert.equal(first.schedules[0]?.id, 1001)
  assert.equal(second.student.id, 102)
  assert.equal(second.schedules[0]?.id, 1002)
})

test('空绑定和空列表可以正常返回', async () => {
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async (url) =>
      url === 'http://api.test/parent/students'
        ? jsonResponse([])
        : jsonResponse(emptyOverview),
  })

  assert.deepEqual(await client.listStudents(), [])
  assert.deepEqual((await client.getOverview(101)).schedules, [])
})

test('请假成功把服务端 LeaveRequest 返回给页面写入列表', async () => {
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/parent/leave-requests')
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init?.body)), {
        studentId: 101,
        scheduleId: 1001,
        reason: '身体不适',
        contactPhone: '13800000001',
      })
      return jsonResponse(leaveRequest, 201)
    },
  })

  const request = await client.submitLeaveRequest({
    studentId: 101,
    scheduleId: 1001,
    reason: '身体不适',
    contactPhone: '13800000001',
  })

  assert.equal(request.id, 9001)
  assert.equal(request.status, 'PENDING')
})

test('重复请假、字段错误和网络错误不会显示假成功', async (context) => {
  for (const scenario of [
    {
      name: '重复请假',
      fetchImpl: async () =>
        jsonResponse({ code: 'CONFLICT', message: '该课次已有待处理请假申请' }, 409),
      expected: /该课次已有待处理请假申请/,
      status: 409,
    },
    {
      name: '字段错误',
      fetchImpl: async () =>
        jsonResponse({ code: 'VALIDATION_ERROR', message: 'reason 不能为空' }, 422),
      expected: /reason 不能为空/,
      status: 422,
    },
    {
      name: '网络错误',
      fetchImpl: async () => {
        throw new TypeError('network unavailable')
      },
      expected: /network unavailable/,
      status: 0,
    },
  ]) {
    await context.test(scenario.name, async () => {
      const client = createParentBusinessClient({
        apiBaseUrl: 'http://api.test',
        authClient: createAuth(),
        fetchImpl: scenario.fetchImpl,
      })

      await assert.rejects(
        () =>
          client.submitLeaveRequest({
            studentId: 101,
            scheduleId: 1001,
            reason: '身体不适',
            contactPhone: '13800000001',
          }),
        (error) =>
          error instanceof ParentBusinessError &&
          error.status === scenario.status &&
          scenario.expected.test(error.message),
      )
    })
  }
})

test('反馈确认成功后返回 CONFIRMED，提出异议必填由后端错误透出', async () => {
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/parent/feedback/5001')
      assert.equal(init?.method, 'PATCH')
      const body = JSON.parse(String(init?.body)) as { status: string }
      if (body.status === 'CONFIRMED') return jsonResponse(confirmedFeedback)
      return jsonResponse({ code: 'VALIDATION_ERROR', message: '提出异议时必须填写异议内容' }, 422)
    },
  })

  const confirmed = await client.respondToFeedback(pendingFeedback.id, {
    status: 'CONFIRMED',
    parentResponse: '',
  })
  assert.equal(confirmed.status, 'CONFIRMED')

  await assert.rejects(
    () =>
      client.respondToFeedback(pendingFeedback.id, {
        status: 'DISPUTED',
        parentResponse: '',
      }),
    /提出异议时必须填写异议内容/,
  )
})

test('反馈异议成功后返回 DISPUTED', async () => {
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async () => jsonResponse(disputedFeedback),
  })

  const disputed = await client.respondToFeedback(5001, {
    status: 'DISPUTED',
    parentResponse: '课堂记录与实际情况不一致。',
  })

  assert.equal(disputed.status, 'DISPUTED')
  assert.equal(disputed.parentResponse, '课堂记录与实际情况不一致。')
})

test('调课通知和普通通知可以标记已读', async () => {
  const readAt = '2026-08-18T18:00:00+08:00'
  const client = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/parent/notifications/8002/read')
      assert.equal(init?.method, 'PATCH')
      assert.deepEqual(JSON.parse(String(init?.body)), { read: true })
      return jsonResponse({
        ...scheduleChangeNotice.notification,
        readAt,
      })
    },
  })

  const updated = await client.markNotificationRead(
    scheduleChangeNotice.notification.id,
  )

  assert.equal(updated.readAt, readAt)

  const generalClient = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: createAuth(),
    fetchImpl: async () => jsonResponse({ ...generalNotice, readAt }),
  })

  assert.equal(
    (await generalClient.markNotificationRead(generalNotice.id)).readAt,
    readAt,
  )
})

test('通知已读权限、缺失、冲突和网络错误不会返回假成功', async (context) => {
  for (const scenario of [
    {
      name: '无权读取',
      fetchImpl: async () =>
        jsonResponse({ code: 'FORBIDDEN', message: '家长只能标记自己的通知' }, 403),
      expected: /只能标记自己的通知/,
      status: 403,
    },
    {
      name: '通知不存在',
      fetchImpl: async () =>
        jsonResponse({ code: 'NOT_FOUND', message: '通知不存在' }, 404),
      expected: /通知不存在/,
      status: 404,
    },
    {
      name: '业务冲突',
      fetchImpl: async () =>
        jsonResponse({ code: 'CONFLICT', message: '通知状态已变化，请刷新' }, 409),
      expected: /通知状态已变化，请刷新/,
      status: 409,
    },
    {
      name: '网络错误',
      fetchImpl: async () => {
        throw new TypeError('network unavailable')
      },
      expected: /network unavailable/,
      status: 0,
    },
  ]) {
    await context.test(scenario.name, async () => {
      const client = createParentBusinessClient({
        apiBaseUrl: 'http://api.test',
        authClient: createAuth(),
        fetchImpl: scenario.fetchImpl,
      })

      await assert.rejects(
        () => client.markNotificationRead(8002),
        (error) =>
          error instanceof ParentBusinessError &&
          error.status === scenario.status &&
          scenario.expected.test(error.message),
      )
    })
  }
})

test('调课通知字段完整', () => {
  assert.equal(scheduleChangeNotice.originalDate, '2026-08-19')
  assert.equal(scheduleChangeNotice.originalStartTime, '09:00:00')
  assert.equal(scheduleChangeNotice.originalEndTime, '10:30:00')
  assert.equal(scheduleChangeNotice.newDate, '2026-08-21')
  assert.equal(scheduleChangeNotice.newStartTime, '16:00:00')
  assert.equal(scheduleChangeNotice.newEndTime, '17:30:00')
  assert.equal(scheduleChangeNotice.originalTeacherName, '李老师')
  assert.equal(scheduleChangeNotice.substituteTeacherName, '周老师')
})

test('401 清理 Token，其他业务错误保留登录状态', async () => {
  const auth = createAuth()
  const unauthorizedClient = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: auth,
    fetchImpl: async () =>
      jsonResponse({ code: 'INVALID_SESSION', message: '登录已失效，请重新登录' }, 401),
  })

  await assert.rejects(
    () => unauthorizedClient.listStudents(),
    (error) =>
      error instanceof ParentBusinessError &&
      error.status === 401 &&
      error.message === '登录已失效，请重新登录',
  )
  assert.equal(auth.getAccessToken(), null)

  const forbiddenAuth = createAuth()
  const forbiddenClient = createParentBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: forbiddenAuth,
    fetchImpl: async () =>
      jsonResponse({ code: 'FORBIDDEN', message: '家长只能访问已绑定学生' }, 403),
  })
  await assert.rejects(() => forbiddenClient.getOverview(103), /家长只能访问已绑定学生/)
  assert.equal(forbiddenAuth.getAccessToken(), 'token-201')
})
