import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AdminApiError,
  createAdminApiClient,
} from './adminApiClient'
import { ACCESS_TOKEN_KEY } from './authService'
import type { AdminOverview } from './adminTypes'

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (
  url: string,
  init?: RequestInit,
  calls?: FetchCall[],
) => Promise<Response> | Response

function createFetchMock(handler: FetchHandler) {
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
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function baseOverview(): AdminOverview {
  return {
    campuses: [
      { id: 1, name: '滨江校区' },
      { id: 2, name: '城北校区' },
    ],
    classes: [
      { id: 101, campusId: 1, name: '六年级 1 班' },
      { id: 201, campusId: 2, name: '五年级 1 班' },
    ],
    courses: [
      { id: 11, campusId: 1, name: '数学提高班', subject: '数学' },
    ],
    schedules: [
      {
        id: 1001,
        campusId: 1,
        classId: 101,
        courseId: 11,
        teacherId: 301,
        lessonDate: '2026-08-18',
        startTime: '09:00:00',
        endTime: '10:30:00',
        room: 'A-302',
        status: 'SCHEDULED',
      },
    ],
    users: [
      {
        id: 901,
        campusId: 1,
        displayName: '许教务',
        username: 'academic_901',
        role: 'ACADEMIC_ADMIN',
        active: true,
      },
    ],
    teachers: [
      { id: 301, displayName: '李老师', role: 'TEACHER', campusId: 1 },
      { id: 302, displayName: '周老师', role: 'HOMEROOM_TEACHER', campusId: 1 },
    ],
    scheduleChanges: [
      {
        id: 7001,
        campusId: 1,
        scheduleId: 1001,
        requestedBy: 301,
        reason: '参加教研活动',
        originalTeacherId: 301,
        originalDate: '2026-08-18',
        originalStartTime: '09:00:00',
        originalEndTime: '10:30:00',
        proposedDate: '2026-08-19',
        proposedStartTime: '16:00:00',
        proposedEndTime: '17:30:00',
        status: 'PENDING',
        decisionNote: '',
        substituteNote: '',
        createdAt: '2026-08-17T09:00:00+08:00',
        updatedAt: '2026-08-17T09:00:00+08:00',
      },
    ],
    feedbackWorkOrders: [],
    leaveRequests: [],
  }
}

function setup(handler: FetchHandler) {
  const storage = createMemoryStorage()
  storage.setItem(ACCESS_TOKEN_KEY, 'token-academic')
  const { fetchImpl, calls } = createFetchMock(handler)
  const client = createAdminApiClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })
  return { client, storage, calls }
}

test('加载后台概览会携带 Bearer 令牌', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/overview')
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      'Bearer token-academic',
    )
    return jsonResponse(200, baseOverview())
  })

  const overview = await client.loadOverview()
  assert.equal(overview.campuses.length, 2)
  assert.equal(overview.scheduleChanges[0]?.id, 7001)
  assert.equal(calls.length, 1)
})

test('无令牌时抛出 AUTH_REQUIRED', async () => {
  const storage = createMemoryStorage()
  const { fetchImpl } = createFetchMock(() => jsonResponse(200, baseOverview()))
  const client = createAdminApiClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
  })

  await assert.rejects(
    client.loadOverview(),
    (error) => {
      assert.ok(error instanceof AdminApiError)
      assert.equal(error.status, 401)
      assert.equal(error.code, 'AUTH_REQUIRED')
      return true
    },
  )
})

test('401 时触发未授权回调', async () => {
  let unauthorizedCalled = 0
  const storage = createMemoryStorage()
  storage.setItem(ACCESS_TOKEN_KEY, 'token-academic')
  const { fetchImpl } = createFetchMock(() =>
    jsonResponse(401, {
      code: 'INVALID_SESSION',
      message: '登录已失效，请重新登录',
    }),
  )
  const client = createAdminApiClient({
    apiBaseUrl: 'http://api.test',
    fetchImpl,
    storage,
    onUnauthorized() {
      unauthorizedCalled += 1
      storage.removeItem(ACCESS_TOKEN_KEY)
    },
  })

  await assert.rejects(
    client.loadOverview(),
    (error) => {
      assert.ok(error instanceof AdminApiError)
      assert.equal(error.code, 'AUTH_REQUIRED')
      return true
    },
  )
  assert.equal(unauthorizedCalled, 1)
  assert.equal(storage.getItem(ACCESS_TOKEN_KEY), null)
})

test('403 返回服务端业务错误且不修改本地状态', async () => {
  const { client, storage, calls } = setup(() =>
    jsonResponse(403, {
      code: 'FORBIDDEN',
      message: '教务只能访问所属校区的数据',
    }),
  )

  await assert.rejects(
    client.loadOverview(),
    (error) => {
      assert.ok(error instanceof AdminApiError)
      assert.equal(error.status, 403)
      assert.equal(error.code, 'FORBIDDEN')
      assert.equal(error.message, '教务只能访问所属校区的数据')
      return true
    },
  )
  assert.equal(storage.getItem(ACCESS_TOKEN_KEY), 'token-academic')
  assert.equal(calls.length, 1)
})

test('409 返回服务端业务错误', async () => {
  const { client } = setup(() =>
    jsonResponse(409, {
      code: 'CONFLICT',
      message: '该调课申请已经审批',
    }),
  )

  await assert.rejects(
    client.reviewScheduleChange({
      changeId: 7001,
      decision: 'APPROVED',
      decisionNote: '',
    }),
    (error) => {
      assert.ok(error instanceof AdminApiError)
      assert.equal(error.status, 409)
      assert.equal(error.code, 'CONFLICT')
      assert.equal(error.message, '该调课申请已经审批')
      return true
    },
  )
})

test('网络错误转换为 NETWORK_ERROR', async () => {
  const { client } = setup(() => {
    throw new TypeError('fetch failed')
  })

  await assert.rejects(
    client.loadOverview(),
    (error) => {
      assert.ok(error instanceof AdminApiError)
      assert.equal(error.code, 'NETWORK_ERROR')
      return true
    },
  )
})

test('审批调课发送正确请求体并返回更新后的申请', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/schedule-changes/7001/review')
    assert.equal(init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      decision: 'APPROVED',
      decisionNote: '无冲突',
    })
    return jsonResponse(200, {
      ...baseOverview().scheduleChanges[0],
      status: 'APPROVED',
      decisionNote: '无冲突',
      reviewedBy: 901,
      reviewedAt: '2026-08-17T12:00:00+08:00',
      updatedAt: '2026-08-17T12:00:00+08:00',
    })
  })

  const reviewed = await client.reviewScheduleChange({
    changeId: 7001,
    decision: 'APPROVED',
    decisionNote: '无冲突',
  })
  assert.equal(reviewed.status, 'APPROVED')
  assert.equal(calls.length, 1)
})

test('安排代课发送教师 ID 并返回更新后的申请', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/schedule-changes/7001/substitute')
    assert.equal(init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      substituteTeacherId: 302,
      substituteNote: '已确认',
    })
    return jsonResponse(200, {
      ...baseOverview().scheduleChanges[0],
      status: 'SUBSTITUTE_ASSIGNED',
      substituteTeacherId: 302,
      substituteNote: '已确认',
      updatedAt: '2026-08-17T12:00:00+08:00',
    })
  })

  const assigned = await client.assignSubstitute({
    changeId: 7001,
    substituteTeacherId: 302,
    substituteNote: '已确认',
  })
  assert.equal(assigned.status, 'SUBSTITUTE_ASSIGNED')
  assert.equal(assigned.substituteTeacherId, 302)
  assert.equal(calls.length, 1)
})

test('工单 START 返回 PROCESSING', async () => {
  const { client } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/work-orders/6001')
    assert.deepEqual(JSON.parse(String(init?.body)), { action: 'START' })
    return jsonResponse(200, {
      id: 6001,
      feedbackId: 501,
      campusId: 1,
      issue: '家长异议',
      status: 'PROCESSING',
      handlerId: 901,
      result: '',
      createdAt: '2026-08-17T09:00:00+08:00',
      updatedAt: '2026-08-17T12:00:00+08:00',
    })
  })

  const workOrder = await client.updateWorkOrder({
    workOrderId: 6001,
    action: 'START',
  })
  assert.equal(workOrder.status, 'PROCESSING')
})

test('工单 CLOSE 发送处理结果', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/work-orders/6001')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      action: 'CLOSE',
      result: '已处理完成',
    })
    return jsonResponse(200, {
      id: 6001,
      feedbackId: 501,
      campusId: 1,
      issue: '家长异议',
      status: 'CLOSED',
      handlerId: 901,
      result: '已处理完成',
      createdAt: '2026-08-17T09:00:00+08:00',
      updatedAt: '2026-08-17T12:00:00+08:00',
      closedAt: '2026-08-17T12:00:00+08:00',
    })
  })

  const workOrder = await client.updateWorkOrder({
    workOrderId: 6001,
    action: 'CLOSE',
    result: '已处理完成',
  })
  assert.equal(workOrder.status, 'CLOSED')
  assert.equal(calls.length, 1)
})

test('请假审批发送决策和原因', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/leave-requests/8001/review')
    assert.equal(init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      decision: 'APPROVED',
      reviewNote: '已核实',
    })
    return jsonResponse(200, {
      id: 8001,
      parentId: 201,
      studentId: 101,
      scheduleId: 1001,
      reason: '身体不适',
      contactPhone: '13800000000',
      status: 'APPROVED',
      reviewNote: '已核实',
      reviewedBy: 901,
      reviewedAt: '2026-08-20T12:00:00+08:00',
      createdAt: '2026-08-20T09:00:00+08:00',
      updatedAt: '2026-08-20T12:00:00+08:00',
    })
  })

  const leave = await client.reviewLeaveRequest({
    leaveRequestId: 8001,
    decision: 'APPROVED',
    reviewNote: '已核实',
  })
  assert.equal(leave.status, 'APPROVED')
  assert.equal(leave.reviewNote, '已核实')
  assert.equal(calls.length, 1)
})

test('新增课次发送完整排课数据', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/schedules')
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 302,
      lessonDate: '2026-08-21',
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
    })
    return jsonResponse(201, {
      id: 1009,
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 302,
      lessonDate: '2026-08-21',
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
      status: 'SCHEDULED',
    })
  })

  const schedule = await client.createSchedule({
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 302,
    lessonDate: '2026-08-21',
    startTime: '09:00:00',
    endTime: '10:30:00',
    room: 'A-302',
  })
  assert.equal(schedule.id, 1009)
  assert.equal(schedule.status, 'SCHEDULED')
  assert.equal(calls.length, 1)
})

test('修改课次发送变更字段', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/schedules/1001')
    assert.equal(init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(init?.body)), {
      teacherId: 302,
      lessonDate: '2026-08-22',
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
    })
    return jsonResponse(200, {
      id: 1001,
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 302,
      lessonDate: '2026-08-22',
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
      status: 'SCHEDULED',
    })
  })

  const schedule = await client.updateSchedule({
    scheduleId: 1001,
    changes: {
      teacherId: 302,
      lessonDate: '2026-08-22',
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
    },
  })
  assert.equal(schedule.teacherId, 302)
  assert.equal(calls.length, 1)
})

test('取消课次发送 CANCELLED 状态', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/schedules/1001')
    assert.deepEqual(JSON.parse(String(init?.body)), { status: 'CANCELLED' })
    return jsonResponse(200, {
      id: 1001,
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      lessonDate: '2026-08-21',
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
      status: 'CANCELLED',
    })
  })

  const schedule = await client.updateSchedule({
    scheduleId: 1001,
    changes: { status: 'CANCELLED' },
  })
  assert.equal(schedule.status, 'CANCELLED')
  assert.equal(calls.length, 1)
})

test('账号启停发送 active 状态', async () => {
  const { client, calls } = setup((url, init) => {
    assert.equal(url, 'http://api.test/admin/users/301')
    assert.equal(init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(init?.body)), { active: false })
    return jsonResponse(200, {
      id: 301,
      campusId: 1,
      displayName: '李老师',
      username: 'teacher_301',
      role: 'TEACHER',
      active: false,
    })
  })

  const user = await client.updateUser({ userId: 301, active: false })
  assert.equal(user.active, false)
  assert.equal(calls.length, 1)
})
