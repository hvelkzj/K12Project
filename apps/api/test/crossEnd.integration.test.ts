import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ApiError,
  Assignment,
  AttendanceRecord,
  FeedbackWorkOrder,
  LeaveRequest,
  LoginResponse,
  Notification,
  ScheduleChange,
  ScheduleSummary,
  StudentFeedback,
  Submission,
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
  ParentOverview,
  StudentOverview,
  TeacherOverview,
} from '../src/businessTypes.js'
import {
  callHandler,
  parseJsonBody,
  type TestRequestOptions,
  type TestResponseState,
} from './httpTestUtils.js'

const fixedNow = Date.parse('2026-08-21T10:00:00+08:00')

function setup(
  options: { now?: () => number; seed?: BusinessSeed } = {},
) {
  const now = options.now ?? (() => fixedNow)
  let tokenNumber = 0
  const authService = createAuthService({
    now,
    createToken: () => `cross-end-token-${++tokenNumber}`,
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
  assert.equal(response.status, 200, `登录失败：${username}`)
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

function assertError(
  response: TestResponseState,
  status: number,
  code: ApiError['code'],
): void {
  assert.equal(response.status, status)
  assert.equal(parseJsonBody<ApiError>(response).code, code)
}

test('流程 1：教师发布、学生提交、教师批改后学生读取结果', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')

  const wrongRole = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {},
  })
  assertError(wrongRole, 403, 'FORBIDDEN')

  const crossCampus = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 201,
      courseId: 13,
      scheduleId: 2001,
      title: '跨校区作业',
      description: '不应发布。',
      attachments: [],
      dueAt: '2026-08-25T20:00:00+08:00',
      allowLate: false,
    },
  })
  assertError(crossCampus, 403, 'FORBIDDEN')

  const publishResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      title: '第三轮分数练习',
      description: '完成并提交计算过程。',
      attachments: [],
      dueAt: '2026-08-25T20:00:00+08:00',
      allowLate: false,
    },
  })
  assert.equal(publishResponse.status, 201)
  const assignment = parseJsonBody<Assignment>(publishResponse)

  const studentBeforeResponse = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  assert.ok(
    parseJsonBody<StudentOverview>(studentBeforeResponse).assignments.some(
      (item) => item.id === assignment.id,
    ),
  )

  const submitResponse = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '计算过程和答案。',
      attachments: [],
    },
  })
  assert.equal(submitResponse.status, 201)
  const submission = parseJsonBody<Submission>(submitResponse)

  const teacherOverviewResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.ok(
    parseJsonBody<TeacherOverview>(teacherOverviewResponse).submissions.some(
      (item) => item.id === submission.id,
    ),
  )

  const gradeResponse = await authorizedCall(handler, teacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${submission.id}`,
    jsonBody: {
      score: 95,
      teacherComment: '过程完整。',
      correctionRequired: false,
    },
  })
  assert.equal(gradeResponse.status, 200)
  assert.equal(parseJsonBody<Submission>(gradeResponse).status, 'GRADED')

  const repeatedGrade = await authorizedCall(handler, teacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${submission.id}`,
    jsonBody: {
      score: 96,
      teacherComment: '重复批改。',
      correctionRequired: false,
    },
  })
  assertError(repeatedGrade, 409, 'CONFLICT')

  const studentAfterResponse = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  const result = parseJsonBody<StudentOverview>(
    studentAfterResponse,
  ).submissions.find((item) => item.id === submission.id)
  assert.equal(result?.status, 'GRADED')
  assert.equal(result?.score, 95)
  assert.equal(result?.teacherComment, '过程完整。')
})

test('流程 2：教师要求订正后学生再次提交并保留 attempt 历史', async () => {
  let currentTime = fixedNow
  const { handler } = setup({ now: () => currentTime })
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')
  const otherTeacher = await login(handler, 'teacher_302')

  const publishResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      title: '第三轮订正练习',
      description: '根据批改结果完成订正。',
      attachments: [],
      dueAt: '2026-08-26T20:00:00+08:00',
      allowLate: false,
    },
  })
  const assignment = parseJsonBody<Assignment>(publishResponse)

  currentTime += 60_000
  const firstResponse = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '第一次答案。',
      attachments: [],
    },
  })
  const first = parseJsonBody<Submission>(firstResponse)
  assert.equal(first.attempt, 1)

  const unauthorizedGrade = await authorizedCall(handler, otherTeacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${first.id}`,
    jsonBody: {
      score: 70,
      teacherComment: '越权批改。',
      correctionRequired: true,
    },
  })
  assertError(unauthorizedGrade, 403, 'FORBIDDEN')

  currentTime += 60_000
  const revisionResponse = await authorizedCall(handler, teacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${first.id}`,
    jsonBody: {
      score: 70,
      teacherComment: '请补充计算步骤。',
      correctionRequired: true,
    },
  })
  assert.equal(
    parseJsonBody<Submission>(revisionResponse).status,
    'REVISION_REQUIRED',
  )

  currentTime += 60_000
  const secondResponse = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '第二次答案，已补充步骤。',
      attachments: [],
    },
  })
  assert.equal(secondResponse.status, 201)
  const second = parseJsonBody<Submission>(secondResponse)
  assert.equal(second.attempt, 2)

  const repeatedSubmit = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '未再次要求订正时重复提交。',
      attachments: [],
    },
  })
  assertError(repeatedSubmit, 409, 'CONFLICT')

  const overviewResponse = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  const attempts = parseJsonBody<StudentOverview>(overviewResponse)
    .submissions.filter((item) => item.assignmentId === assignment.id)
    .sort((left, right) => left.attempt - right.attempt)
  assert.deepEqual(
    attempts.map((item) => [item.attempt, item.status]),
    [
      [1, 'REVISION_REQUIRED'],
      [2, 'SUBMITTED'],
    ],
  )
  assert.equal(attempts[0]?.teacherComment, '请补充计算步骤。')
})

test('流程 3：调课审批和代课生成家长通知并支持标记已读', async () => {
  let currentTime = fixedNow
  const seed = createBusinessSeed(fixedNow)
  seed.scheduleChanges = seed.scheduleChanges.filter((item) => item.id === 7002)
  const { handler } = setup({ now: () => currentTime, seed })
  const parent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')
  const academic = await login(handler, 'academic_901')

  const requestResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/schedule-changes',
    jsonBody: {
      scheduleId: 1001,
      reason: '参加第三轮教研活动',
      proposedDate: '2026-08-24',
      proposedStartTime: '10:00:00',
      proposedEndTime: '11:30:00',
    },
  })
  assert.equal(requestResponse.status, 201)
  const change = parseJsonBody<ScheduleChange>(requestResponse)

  const crossCampus = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7002/review',
    jsonBody: { decision: 'APPROVED', decisionNote: '越权审批' },
  })
  assertError(crossCampus, 403, 'FORBIDDEN')

  const wrongRole = await authorizedCall(handler, student, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/review`,
    jsonBody: { decision: 'APPROVED', decisionNote: '' },
  })
  assertError(wrongRole, 403, 'FORBIDDEN')

  currentTime += 60_000
  const approvedResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/review`,
    jsonBody: { decision: 'APPROVED', decisionNote: '同意调课' },
  })
  assert.equal(
    parseJsonBody<ScheduleChange>(approvedResponse).status,
    'APPROVED',
  )

  const repeatedReview = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/review`,
    jsonBody: { decision: 'APPROVED', decisionNote: '重复审批' },
  })
  assertError(repeatedReview, 409, 'CONFLICT')

  const originalTeacher = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/substitute`,
    jsonBody: { substituteTeacherId: 301, substituteNote: '' },
  })
  assertError(originalTeacher, 422, 'VALIDATION_ERROR')

  currentTime += 60_000
  const substituteResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/substitute`,
    jsonBody: {
      substituteTeacherId: 303,
      substituteNote: '已确认代课时间',
    },
  })
  assert.equal(
    parseJsonBody<ScheduleChange>(substituteResponse).status,
    'SUBSTITUTE_ASSIGNED',
  )

  const parentOverviewResponse = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students/101/overview',
  })
  const notice = parseJsonBody<ParentOverview>(
    parentOverviewResponse,
  ).scheduleChangeNotices.find(
    (item) => item.notification.relatedId === change.id,
  )
  assert.ok(notice)
  assert.equal(notice.originalTeacherName, '李老师')
  assert.equal(notice.substituteTeacherName, '王老师')
  assert.equal(notice.notification.readAt, null)

  currentTime += 60_000
  const readResponse = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/notifications/${notice.notification.id}/read`,
    jsonBody: { read: true },
  })
  const readNotice = parseJsonBody<Notification>(readResponse)
  assert.equal(readNotice.readAt, '2026-08-21T02:03:00.000Z')

  const repeatedRead = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/notifications/${notice.notification.id}/read`,
    jsonBody: { read: true },
  })
  assert.equal(parseJsonBody<Notification>(repeatedRead).readAt, readNotice.readAt)

  const wrongReader = await authorizedCall(handler, student, {
    method: 'PATCH',
    url: `/parent/notifications/${notice.notification.id}/read`,
    jsonBody: { read: true },
  })
  assertError(wrongReader, 403, 'FORBIDDEN')

  const refreshedParentOverview = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students/101/overview',
  })
  const refreshedNotice = parseJsonBody<ParentOverview>(
    refreshedParentOverview,
  ).scheduleChangeNotices.find(
    (item) => item.notification.relatedId === change.id,
  )
  assert.equal(refreshedNotice?.notification.readAt, readNotice.readAt)
})

test('流程 4：教师反馈经家长异议生成并关闭后台工单', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_302')
  const academic = await login(handler, 'academic_901')

  const feedbackResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/feedback',
    jsonBody: {
      scheduleId: 1003,
      studentId: 101,
      performance: '课堂朗读认真。',
      strengths: '发音准确。',
      improvements: '需要稳定语速。',
      suggestion: '每天朗读十分钟。',
    },
  })
  assert.equal(feedbackResponse.status, 201)
  const feedback = parseJsonBody<StudentFeedback>(feedbackResponse)

  const emptyDispute = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/feedback/${feedback.id}`,
    jsonBody: { status: 'DISPUTED', parentResponse: '   ' },
  })
  assertError(emptyDispute, 422, 'VALIDATION_ERROR')

  const disputeResponse = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/feedback/${feedback.id}`,
    jsonBody: {
      status: 'DISPUTED',
      parentResponse: '希望核对当天的课堂记录。',
    },
  })
  assert.equal(
    parseJsonBody<StudentFeedback>(disputeResponse).status,
    'DISPUTED',
  )

  const adminOverviewResponse = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  const workOrder = parseJsonBody<AdminOverview>(
    adminOverviewResponse,
  ).feedbackWorkOrders.find((item) => item.feedbackId === feedback.id)
  assert.ok(workOrder)
  assert.equal(workOrder.status, 'OPEN')

  const wrongRole = await authorizedCall(handler, student, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'START' },
  })
  assertError(wrongRole, 403, 'FORBIDDEN')

  const startedResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'START' },
  })
  assert.equal(
    parseJsonBody<FeedbackWorkOrder>(startedResponse).status,
    'PROCESSING',
  )

  const repeatedStart = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'START' },
  })
  assertError(repeatedStart, 409, 'CONFLICT')

  const emptyResult = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'CLOSE', result: '   ' },
  })
  assertError(emptyResult, 422, 'VALIDATION_ERROR')

  const closeResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'CLOSE', result: '已核对并回复家长。' },
  })
  assert.equal(
    parseJsonBody<FeedbackWorkOrder>(closeResponse).status,
    'CLOSED',
  )

  const repeatedClose = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'CLOSE', result: '重复关闭。' },
  })
  assertError(repeatedClose, 409, 'CONFLICT')
})

test('流程 5：家长请假经后台批准后教师只能登记 LEAVE', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')
  const academic = await login(handler, 'academic_901')

  const unboundStudent = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      studentId: 103,
      scheduleId: 2001,
      reason: '越权请假',
      contactPhone: '13800000001',
    },
  })
  assertError(unboundStudent, 403, 'FORBIDDEN')

  const leaveResponse = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      studentId: 101,
      scheduleId: 1001,
      reason: '身体不适',
      contactPhone: '13800000001',
    },
  })
  assert.equal(leaveResponse.status, 201)
  const leave = parseJsonBody<LeaveRequest>(leaveResponse)

  const wrongRole = await authorizedCall(handler, student, {
    method: 'PATCH',
    url: `/admin/leave-requests/${leave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assertError(wrongRole, 403, 'FORBIDDEN')

  const reviewResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${leave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assert.equal(parseJsonBody<LeaveRequest>(reviewResponse).status, 'APPROVED')

  const repeatedReview = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${leave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '' },
  })
  assertError(repeatedReview, 409, 'CONFLICT')

  const teacherBeforeResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.equal(
    parseJsonBody<TeacherOverview>(teacherBeforeResponse).leaveRequests.find(
      (item) => item.id === leave.id,
    )?.status,
    'APPROVED',
  )

  const wrongAttendance = await authorizedCall(handler, teacher, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 1001,
      records: [{ studentId: 101, status: 'PRESENT', note: '' }],
    },
  })
  assertError(wrongAttendance, 422, 'VALIDATION_ERROR')

  const attendanceResponse = await authorizedCall(handler, teacher, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 1001,
      records: [{ studentId: 101, status: 'LEAVE', note: '请假已批准' }],
    },
  })
  assert.equal(attendanceResponse.status, 200)
  assert.equal(
    parseJsonBody<AttendanceRecord[]>(attendanceResponse)[0]?.status,
    'LEAVE',
  )

  const teacherAfterResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.equal(
    parseJsonBody<TeacherOverview>(teacherAfterResponse).attendance.find(
      (item) => item.scheduleId === 1001 && item.studentId === 101,
    )?.status,
    'LEAVE',
  )
})

test('流程 6：后台新增和修改排课后教师概览同步更新', async () => {
  const { handler } = setup()
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')
  const academic = await login(handler, 'academic_901')

  const scheduleInput = {
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    lessonDate: '2026-08-25',
    startTime: '09:00:00',
    endTime: '10:00:00',
    room: 'A-401',
  }

  const wrongRole = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: scheduleInput,
  })
  assertError(wrongRole, 403, 'FORBIDDEN')

  const crossCampus = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 2,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      lessonDate: '2026-08-25',
      startTime: '09:00:00',
      endTime: '10:00:00',
      room: 'C-201',
    },
  })
  assertError(crossCampus, 403, 'FORBIDDEN')

  const createResponse = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: scheduleInput,
  })
  assert.equal(createResponse.status, 201)
  const schedule = parseJsonBody<ScheduleSummary>(createResponse)

  const teacherCreatedResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.equal(
    parseJsonBody<TeacherOverview>(teacherCreatedResponse).schedules.find(
      (item) => item.id === schedule.id,
    )?.room,
    'A-401',
  )

  const duplicateCreate = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: scheduleInput,
  })
  assertError(duplicateCreate, 409, 'CONFLICT')

  const updateResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedules/${schedule.id}`,
    jsonBody: {
      lessonDate: '2026-08-26',
      startTime: '10:30:00',
      endTime: '12:00:00',
      room: 'A-402',
    },
  })
  const updated = parseJsonBody<ScheduleSummary>(updateResponse)
  assert.equal(updated.status, 'CHANGED')
  assert.equal(updated.room, 'A-402')

  const teacherUpdatedResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  const teacherSchedule = parseJsonBody<TeacherOverview>(
    teacherUpdatedResponse,
  ).schedules.find((item) => item.id === schedule.id)
  assert.equal(teacherSchedule?.lessonDate, '2026-08-26')
  assert.equal(teacherSchedule?.startTime, '10:30:00')
  assert.equal(teacherSchedule?.room, 'A-402')
  assert.equal(teacherSchedule?.status, 'CHANGED')
})

test('流程 7：后台停用账号会撤销会话并禁止再次登录', async () => {
  const { handler } = setup()
  const teacher = await login(handler, 'teacher_301')
  const academic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')

  const wrongRole = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: false },
  })
  assertError(wrongRole, 403, 'FORBIDDEN')

  const selfDisable = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/999',
    jsonBody: { active: false },
  })
  assertError(selfDisable, 422, 'VALIDATION_ERROR')

  const disableResponse = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: false },
  })
  assert.equal(disableResponse.status, 200)
  assert.equal(parseJsonBody<UserAccountSummary>(disableResponse).active, false)

  const invalidSession = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assertError(invalidSession, 401, 'INVALID_SESSION')

  const loginWhileDisabled = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: {
      username: 'teacher_301',
      password: MOCK_ACCOUNT_PASSWORD,
    },
  })
  assertError(loginWhileDisabled, 401, 'INVALID_CREDENTIALS')

  const repeatedDisable = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: false },
  })
  assert.equal(repeatedDisable.status, 200)
  assert.equal(parseJsonBody<UserAccountSummary>(repeatedDisable).active, false)

  const enableResponse = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/users/301',
    jsonBody: { active: true },
  })
  assert.equal(parseJsonBody<UserAccountSummary>(enableResponse).active, true)

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
