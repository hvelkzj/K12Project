import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ApiError,
  LeaveRequest,
  LoginResponse,
  Notification,
  ScheduleSummary,
  UserAccountSummary,
} from '@k12/shared'
import { MOCK_ACCOUNT_PASSWORD } from '@k12/shared/mock-accounts'

import { createRequestHandler } from '../src/app.js'
import { createAuthService } from '../src/authService.js'
import {
  createBusinessSeed,
  type BusinessSeed,
} from '../src/businessSeed.js'
import { createBusinessStore } from '../src/businessStore.js'
import type {
  AdminOverview,
  TeacherOverview,
} from '../src/businessTypes.js'
import {
  callHandler,
  parseJsonBody,
  type TestRequestOptions,
} from './httpTestUtils.js'

const fixedNow = Date.parse('2026-08-17T10:00:00+08:00')

function setup(
  options: { now?: () => number; seed?: BusinessSeed } = {},
) {
  const now = options.now ?? (() => fixedNow)
  let tokenNumber = 0
  const authService = createAuthService({
    now,
    createToken: () => `management-token-${++tokenNumber}`,
  })
  const businessStore = createBusinessStore({ now, seed: options.seed })
  return {
    handler: createRequestHandler(authService, businessStore),
  }
}

async function login(
  handler: ReturnType<typeof createRequestHandler>,
  username: string,
): Promise<string> {
  const response = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: { username, password: MOCK_ACCOUNT_PASSWORD },
  })
  assert.equal(response.status, 200)
  return parseJsonBody<LoginResponse>(response).accessToken
}

async function authorizedCall(
  handler: ReturnType<typeof createRequestHandler>,
  token: string,
  options: TestRequestOptions,
) {
  return callHandler(handler, {
    ...options,
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  })
}

function pendingLeave(
  id: number,
  studentId: number,
  scheduleId: number,
): LeaveRequest {
  const timestamp = '2026-08-17T02:00:00.000Z'
  return {
    id,
    parentId: 201,
    studentId,
    scheduleId,
    reason: '测试请假',
    contactPhone: '13800000001',
    status: 'PENDING',
    reviewedBy: null,
    reviewNote: '',
    reviewedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

test('对应家长可以标记通知已读，越权和其他角色被拒绝', async () => {
  let currentTime = fixedNow
  const seed = createBusinessSeed(fixedNow)
  seed.notifications.push({
    id: 8002,
    userId: 202,
    studentId: 101,
    type: 'GENERAL',
    title: '其他家长通知',
    content: '仅用于权限测试。',
    relatedType: 'General',
    relatedId: null,
    readAt: null,
    createdAt: '2026-08-17T01:00:00.000Z',
  })
  const { handler } = setup({ now: () => currentTime, seed })
  const parent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_101')

  const read = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: '/parent/notifications/8001/read',
    jsonBody: { read: true },
  })
  assert.equal(read.status, 200)
  const notification = parseJsonBody<Notification>(read)
  assert.equal(notification.userId, 201)
  assert.equal(notification.readAt, '2026-08-17T02:00:00.000Z')

  currentTime += 60 * 60 * 1000
  const repeated = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: '/parent/notifications/8001/read',
    jsonBody: { read: true },
  })
  assert.equal(parseJsonBody<Notification>(repeated).readAt, notification.readAt)

  const otherParentNotification = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: '/parent/notifications/8002/read',
    jsonBody: { read: true },
  })
  assert.equal(otherParentNotification.status, 403)

  const wrongRole = await authorizedCall(handler, student, {
    method: 'PATCH',
    url: '/parent/notifications/8001/read',
    jsonBody: { read: true },
  })
  assert.equal(wrongRole.status, 403)

  const invalidRead = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: '/parent/notifications/8001/read',
    jsonBody: { read: false },
  })
  assert.equal(invalidRead.status, 422)
})

test('请假进入教师和后台概览，并支持通过、拒绝和跨校区校验', async () => {
  const seed = createBusinessSeed(fixedNow)
  seed.leaveRequests.push(pendingLeave(9100, 103, 2001))
  const { handler } = setup({ seed })
  const parent = await login(handler, 'parent_201')
  const teacher = await login(handler, 'teacher_301')
  const academic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')

  const first = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      studentId: 101,
      scheduleId: 1001,
      reason: '身体不适',
      contactPhone: '13800000001',
    },
  })
  const second = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      studentId: 102,
      scheduleId: 1002,
      reason: '家庭事务',
      contactPhone: '13800000002',
    },
  })
  const firstLeave = parseJsonBody<LeaveRequest>(first)
  const secondLeave = parseJsonBody<LeaveRequest>(second)

  const teacherResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.deepEqual(
    parseJsonBody<TeacherOverview>(teacherResponse).leaveRequests.map(
      (item) => item.id,
    ),
    [firstLeave.id],
  )

  const adminResponse = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  assert.deepEqual(
    parseJsonBody<AdminOverview>(adminResponse).leaveRequests.map(
      (item) => item.id,
    ),
    [firstLeave.id, secondLeave.id],
  )

  const approved = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${firstLeave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assert.equal(approved.status, 200)
  const approvedLeave = parseJsonBody<LeaveRequest>(approved)
  assert.equal(approvedLeave.reviewedBy, 901)
  assert.equal(approvedLeave.reviewedAt, '2026-08-17T02:00:00.000Z')

  const missingReason = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${secondLeave.id}/review`,
    jsonBody: { decision: 'REJECTED', reviewNote: '   ' },
  })
  assert.equal(missingReason.status, 422)

  const rejected = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${secondLeave.id}/review`,
    jsonBody: { decision: 'REJECTED', reviewNote: '材料不完整' },
  })
  assert.equal(parseJsonBody<LeaveRequest>(rejected).status, 'REJECTED')

  const repeated = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${firstLeave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assert.equal(repeated.status, 409)

  const crossCampus = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/leave-requests/9100/review',
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assert.equal(crossCampus.status, 403)

  const systemApproved = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/leave-requests/9100/review',
    jsonBody: { decision: 'APPROVED', reviewNote: '全校区审批' },
  })
  assert.equal(systemApproved.status, 200)
})

test('批准请假强制 LEAVE，并纠正审批前已有签到', async () => {
  const pendingSeed = createBusinessSeed(fixedNow)
  pendingSeed.leaveRequests.push(pendingLeave(9300, 101, 1001))
  pendingSeed.attendance.push({
    id: 10_100,
    scheduleId: 1001,
    studentId: 101,
    status: 'PRESENT',
    note: '',
    recordedBy: 301,
    recordedAt: '2026-08-17T01:30:00.000Z',
  })
  const pendingSetup = setup({ seed: pendingSeed })
  const academic = await login(pendingSetup.handler, 'academic_901')
  const teacher = await login(pendingSetup.handler, 'teacher_301')

  const reviewed = await authorizedCall(pendingSetup.handler, academic, {
    method: 'PATCH',
    url: '/admin/leave-requests/9300/review',
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assert.equal(reviewed.status, 200)
  const teacherOverviewResponse = await authorizedCall(
    pendingSetup.handler,
    teacher,
    { method: 'GET', url: '/teacher/overview' },
  )
  const correctedAttendance = parseJsonBody<TeacherOverview>(
    teacherOverviewResponse,
  ).attendance.find(
    (item) => item.scheduleId === 1001 && item.studentId === 101,
  )
  assert.equal(correctedAttendance?.status, 'LEAVE')

  const approvedSeed = createBusinessSeed(fixedNow)
  approvedSeed.leaveRequests.push({
    ...pendingLeave(9301, 101, 1001),
    status: 'APPROVED',
    reviewedBy: 901,
    reviewedAt: '2026-08-17T01:45:00.000Z',
  })
  const approvedSetup = setup({ seed: approvedSeed })
  const approvedTeacher = await login(approvedSetup.handler, 'teacher_301')
  const invalidAttendance = await authorizedCall(
    approvedSetup.handler,
    approvedTeacher,
    {
      method: 'PUT',
      url: '/teacher/attendance',
      jsonBody: {
        scheduleId: 1001,
        records: [{ studentId: 101, status: 'PRESENT', note: '' }],
      },
    },
  )
  assert.equal(invalidAttendance.status, 422)

  const leaveAttendance = await authorizedCall(
    approvedSetup.handler,
    approvedTeacher,
    {
      method: 'PUT',
      url: '/teacher/attendance',
      jsonBody: {
        scheduleId: 1001,
        records: [{ studentId: 101, status: 'LEAVE', note: '' }],
      },
    },
  )
  assert.equal(leaveAttendance.status, 200)
})

test('排课新增、修改和取消校验校区、时间与资源冲突', async () => {
  const { handler } = setup()
  const academic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')

  const teacherConflict = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 1,
      classId: 102,
      courseId: 12,
      teacherId: 301,
      lessonDate: '2026-08-18',
      startTime: '09:30:00',
      endTime: '11:00:00',
      room: 'B-301',
    },
  })
  assert.equal(teacherConflict.status, 409)
  assert.match(parseJsonBody<ApiError>(teacherConflict).message, /教师/)

  const classConflict = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 303,
      lessonDate: '2026-08-18',
      startTime: '09:30:00',
      endTime: '11:00:00',
      room: 'A-303',
    },
  })
  assert.equal(classConflict.status, 409)
  assert.match(parseJsonBody<ApiError>(classConflict).message, /班级/)

  const invalidTime = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      lessonDate: '2026-08-20',
      startTime: '12:00:00',
      endTime: '11:00:00',
      room: 'A-304',
    },
  })
  assert.equal(invalidTime.status, 422)

  const crossCampus = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 2,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      lessonDate: '2026-08-20',
      startTime: '09:00:00',
      endTime: '10:00:00',
      room: 'C-201',
    },
  })
  assert.equal(crossCampus.status, 403)

  const createdResponse = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      lessonDate: '2026-08-20',
      startTime: '09:00:00',
      endTime: '10:00:00',
      room: 'A-304',
    },
  })
  assert.equal(createdResponse.status, 201)
  const created = parseJsonBody<ScheduleSummary>(createdResponse)
  assert.equal(created.status, 'SCHEDULED')

  const updateConflict = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${created.id}`,
    jsonBody: {
      teacherId: 303,
      lessonDate: '2026-08-18',
      startTime: '14:30:00',
      endTime: '15:00:00',
    },
  })
  assert.equal(updateConflict.status, 409)

  const updatedResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${created.id}`,
    jsonBody: {
      startTime: '10:30:00',
      endTime: '12:00:00',
      room: 'A-305',
    },
  })
  const updated = parseJsonBody<ScheduleSummary>(updatedResponse)
  assert.equal(updated.status, 'CHANGED')
  assert.equal(updated.room, 'A-305')

  const immutableIdentity = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${created.id}`,
    jsonBody: { classId: 102 },
  })
  assert.equal(immutableIdentity.status, 422)

  const cancelledResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${created.id}`,
    jsonBody: { status: 'CANCELLED' },
  })
  assert.equal(
    parseJsonBody<ScheduleSummary>(cancelledResponse).status,
    'CANCELLED',
  )

  const repeatedCancel = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${created.id}`,
    jsonBody: { status: 'CANCELLED' },
  })
  assert.equal(repeatedCancel.status, 409)

  const updateCancelled = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${created.id}`,
    jsonBody: { room: 'A-306' },
  })
  assert.equal(updateCancelled.status, 409)

  const systemCreated = await authorizedCall(handler, system, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 2,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      lessonDate: '2026-08-20',
      startTime: '09:00:00',
      endTime: '10:00:00',
      room: 'C-201',
    },
  })
  assert.equal(systemCreated.status, 201)
})

test('系统管理员停用账号会撤销全部会话并阻止重新登录', async () => {
  const { handler } = setup()
  const system = await login(handler, 'system_999')
  const firstTeacher = await login(handler, 'teacher_301')
  const secondTeacher = await login(handler, 'teacher_301')
  const academic = await login(handler, 'academic_901')

  const academicDenied = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: false },
  })
  assert.equal(academicDenied.status, 403)

  const selfDisable = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/999',
    jsonBody: { active: false },
  })
  assert.equal(selfDisable.status, 422)

  const disabled = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: false },
  })
  assert.equal(disabled.status, 200)
  assert.equal(parseJsonBody<UserAccountSummary>(disabled).active, false)

  for (const token of [firstTeacher, secondTeacher]) {
    const current = await authorizedCall(handler, token, {
      method: 'GET',
      url: '/auth/me',
    })
    assert.equal(current.status, 401)
    assert.equal(parseJsonBody<ApiError>(current).code, 'INVALID_SESSION')
  }

  const loginWhileDisabled = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: {
      username: 'teacher_301',
      password: MOCK_ACCOUNT_PASSWORD,
    },
  })
  assert.equal(loginWhileDisabled.status, 401)
  assert.equal(
    parseJsonBody<ApiError>(loginWhileDisabled).code,
    'INVALID_CREDENTIALS',
  )

  const enabled = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: true },
  })
  assert.equal(parseJsonBody<UserAccountSummary>(enabled).active, true)

  const loginAfterEnable = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: {
      username: 'teacher_301',
      password: MOCK_ACCOUNT_PASSWORD,
    },
  })
  assert.equal(loginAfterEnable.status, 200)
})

test('六角色对第二轮管理接口执行后端权限校验', async () => {
  const seed = createBusinessSeed(fixedNow)
  seed.leaveRequests.push(
    pendingLeave(9201, 101, 1001),
    pendingLeave(9202, 102, 1002),
  )
  const { handler } = setup({ seed })
  const tokens = {
    parent: await login(handler, 'parent_201'),
    student: await login(handler, 'student_101'),
    teacher: await login(handler, 'teacher_301'),
    homeroom: await login(handler, 'teacher_302'),
    academic: await login(handler, 'academic_901'),
    system: await login(handler, 'system_999'),
  }

  const parentRead = await authorizedCall(handler, tokens.parent, {
    method: 'PATCH',
    url: '/parent/notifications/8001/read',
    jsonBody: { read: true },
  })
  assert.equal(parentRead.status, 200)
  for (const token of [
    tokens.student,
    tokens.teacher,
    tokens.homeroom,
    tokens.academic,
    tokens.system,
  ]) {
    const denied = await authorizedCall(handler, token, {
      method: 'PATCH',
      url: '/parent/notifications/8001/read',
      jsonBody: { read: true },
    })
    assert.equal(denied.status, 403)
  }

  const campusOneSchedule = {
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    lessonDate: '2026-08-21',
    startTime: '09:00:00',
    endTime: '10:00:00',
    room: 'A-401',
  }
  for (const token of [
    tokens.parent,
    tokens.student,
    tokens.teacher,
    tokens.homeroom,
  ]) {
    const denied = await authorizedCall(handler, token, {
      method: 'POST',
      url: '/admin/schedules',
      jsonBody: campusOneSchedule,
    })
    assert.equal(denied.status, 403)
  }
  assert.equal(
    (
      await authorizedCall(handler, tokens.academic, {
        method: 'POST',
        url: '/admin/schedules',
        jsonBody: campusOneSchedule,
      })
    ).status,
    201,
  )
  assert.equal(
    (
      await authorizedCall(handler, tokens.system, {
        method: 'POST',
        url: '/admin/schedules',
        jsonBody: {
          campusId: 2,
          classId: 201,
          courseId: 13,
          teacherId: 401,
          lessonDate: '2026-08-21',
          startTime: '09:00:00',
          endTime: '10:00:00',
          room: 'C-401',
        },
      })
    ).status,
    201,
  )

  for (const token of [
    tokens.parent,
    tokens.student,
    tokens.teacher,
    tokens.homeroom,
  ]) {
    const denied = await authorizedCall(handler, token, {
      method: 'PATCH',
      url: '/admin/leave-requests/9201/review',
      jsonBody: { decision: 'APPROVED', reviewNote: '' },
    })
    assert.equal(denied.status, 403)
  }
  assert.equal(
    (
      await authorizedCall(handler, tokens.academic, {
        method: 'PATCH',
        url: '/admin/leave-requests/9201/review',
        jsonBody: { decision: 'APPROVED', reviewNote: '' },
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await authorizedCall(handler, tokens.system, {
        method: 'PATCH',
        url: '/admin/leave-requests/9202/review',
        jsonBody: { decision: 'APPROVED', reviewNote: '' },
      })
    ).status,
    200,
  )

  for (const token of [
    tokens.parent,
    tokens.student,
    tokens.teacher,
    tokens.homeroom,
    tokens.academic,
  ]) {
    const denied = await authorizedCall(handler, token, {
      method: 'PATCH',
      url: '/admin/users/301',
      jsonBody: { active: true },
    })
    assert.equal(denied.status, 403)
  }
  assert.equal(
    (
      await authorizedCall(handler, tokens.system, {
        method: 'PATCH',
        url: '/admin/users/301',
        jsonBody: { active: true },
      })
    ).status,
    200,
  )
})
