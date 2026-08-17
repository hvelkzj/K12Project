import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ApiError,
  Assignment,
  AttendanceRecord,
  FeedbackWorkOrder,
  LeaveRequest,
  LoginResponse,
  ParentStudentBinding,
  ScheduleChange,
  StudentFeedback,
  Submission,
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
} from './httpTestUtils.js'

const fixedNow = Date.parse('2026-08-17T10:00:00+08:00')

function setup(
  options: { now?: () => number; seed?: BusinessSeed } = {},
) {
  const now = options.now ?? (() => fixedNow)
  let tokenNumber = 0
  const authService = createAuthService({
    now,
    createToken: () => `business-token-${++tokenNumber}`,
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

test('六种角色只能访问各自业务入口', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')
  const homeroom = await login(handler, 'teacher_302')
  const academic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')

  const allowed = [
    [parent, '/parent/students'],
    [student, '/student/overview'],
    [teacher, '/teacher/overview'],
    [homeroom, '/teacher/overview'],
    [academic, '/admin/overview'],
    [system, '/admin/overview'],
  ] as const
  for (const [token, url] of allowed) {
    const response = await authorizedCall(handler, token, {
      method: 'GET',
      url,
    })
    assert.equal(response.status, 200, url)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }

  const denied = [
    [student, '/parent/students'],
    [parent, '/student/overview'],
    [academic, '/teacher/overview'],
    [teacher, '/admin/overview'],
  ] as const
  for (const [token, url] of denied) {
    const response = await authorizedCall(handler, token, {
      method: 'GET',
      url,
    })
    assert.equal(response.status, 403, url)
    assert.equal(parseJsonBody<ApiError>(response).code, 'FORBIDDEN')
  }

  const missing = await callHandler(handler, {
    method: 'GET',
    url: '/student/overview',
  })
  assert.equal(missing.status, 401)
  assert.equal(parseJsonBody<ApiError>(missing).code, 'AUTH_REQUIRED')
})

test('家长只能读取绑定学生并且请假身份来自会话', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')

  const studentsResponse = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students',
  })
  const bindings = parseJsonBody<ParentStudentBinding[]>(studentsResponse)
  assert.deepEqual(
    bindings.map((item) => item.student.id),
    [101, 102],
  )

  const unbound = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students/103/overview',
  })
  assert.equal(unbound.status, 403)

  const leave = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      parentId: 999,
      studentId: 101,
      scheduleId: 1001,
      reason: '身体不适',
      contactPhone: '13800000001',
    },
  })
  assert.equal(leave.status, 201)
  assert.equal(parseJsonBody<LeaveRequest>(leave).parentId, 201)

  const duplicate = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      studentId: 101,
      scheduleId: 1001,
      reason: '重复请假',
      contactPhone: '13800000001',
    },
  })
  assert.equal(duplicate.status, 409)
  assert.equal(parseJsonBody<ApiError>(duplicate).code, 'CONFLICT')
})

test('作业发布、学生提交和教师批改共享同一数据', async () => {
  const { handler } = setup()
  const teacher = await login(handler, 'teacher_301')
  const student = await login(handler, 'student_101')

  const publish = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      title: '新发布作业',
      description: '完成五道练习题。',
      attachments: [],
      dueAt: '2026-08-25T20:00:00+08:00',
      allowLate: false,
    },
  })
  assert.equal(publish.status, 201)
  const assignment = parseJsonBody<Assignment>(publish)
  assert.equal(assignment.teacherId, 301)

  const studentBefore = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  assert.ok(
    parseJsonBody<StudentOverview>(studentBefore).assignments.some(
      (item) => item.id === assignment.id,
    ),
  )

  const submit = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      studentId: 102,
      content: '学生提交正文',
      attachments: [],
    },
  })
  assert.equal(submit.status, 201)
  const submission = parseJsonBody<Submission>(submit)
  assert.equal(submission.studentId, 101)
  assert.equal(submission.attempt, 1)

  const repeated = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '重复提交',
      attachments: [],
    },
  })
  assert.equal(repeated.status, 409)

  const teacherOverviewResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.ok(
    parseJsonBody<TeacherOverview>(teacherOverviewResponse).submissions.some(
      (item) => item.id === submission.id,
    ),
  )

  const grade = await authorizedCall(handler, teacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${submission.id}`,
    jsonBody: {
      score: 101,
      teacherComment: '超出分数范围',
      correctionRequired: false,
    },
  })
  assert.equal(grade.status, 422)

  const validGrade = await authorizedCall(handler, teacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${submission.id}`,
    jsonBody: {
      score: 96,
      teacherComment: '完成认真。',
      correctionRequired: false,
      gradedBy: 999,
    },
  })
  assert.equal(validGrade.status, 200)
  const graded = parseJsonBody<Submission>(validGrade)
  assert.equal(graded.gradedBy, 301)
  assert.equal(graded.status, 'GRADED')

  const studentAfter = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  const result = parseJsonBody<StudentOverview>(studentAfter).submissions.find(
    (item) => item.id === submission.id,
  )
  assert.equal(result?.score, 96)
})

test('截止限制和订正 attempt 历史由服务端维护', async () => {
  let currentTime = fixedNow
  const { handler } = setup({ now: () => currentTime })
  const student = await login(handler, 'student_101')

  const revision = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: 3003,
      content: '第二次订正内容',
      attachments: [],
    },
  })
  assert.equal(revision.status, 201)
  assert.equal(parseJsonBody<Submission>(revision).attempt, 2)

  const overview = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  assert.deepEqual(
    parseJsonBody<StudentOverview>(overview)
      .submissions.filter((item) => item.assignmentId === 3003)
      .map((item) => item.attempt),
    [1, 2],
  )

  currentTime += 5 * 24 * 60 * 60 * 1000
  const renewedStudent = await login(handler, 'student_101')
  const late = await authorizedCall(handler, renewedStudent, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: 3001,
      content: '超过截止时间',
      attachments: [],
    },
  })
  assert.equal(late.status, 409)
  assert.match(parseJsonBody<ApiError>(late).message, /截止/)
})

test('提交接口区分数据不存在和附件字段错误', async () => {
  const { handler } = setup()
  const student = await login(handler, 'student_101')

  const missing = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: 999_999,
      content: '不存在的作业',
      attachments: [],
    },
  })
  assert.equal(missing.status, 404)
  assert.equal(parseJsonBody<ApiError>(missing).code, 'NOT_FOUND')

  const invalidAttachment = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: 3001,
      content: '',
      attachments: [
        {
          id: 1,
          originalName: 'script.exe',
          mimeType: 'application/octet-stream',
          byteSize: 128,
          createdAt: '2026-08-17T10:00:00+08:00',
        },
      ],
    },
  })
  assert.equal(invalidAttachment.status, 422)
  assert.match(parseJsonBody<ApiError>(invalidAttachment).message, /附件/)
})

test('签到限制为本人课次、当前班级且不能重复', async () => {
  const { handler } = setup()
  const teacher = await login(handler, 'teacher_301')
  const homeroom = await login(handler, 'teacher_302')

  const saved = await authorizedCall(handler, teacher, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 1001,
      records: [{ studentId: 101, status: 'PRESENT', note: '' }],
    },
  })
  assert.equal(saved.status, 200)
  assert.equal(parseJsonBody<AttendanceRecord[]>(saved)[0]?.recordedBy, 301)

  const repeated = await authorizedCall(handler, teacher, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 1001,
      records: [{ studentId: 101, status: 'LATE', note: '迟到' }],
    },
  })
  assert.equal(repeated.status, 409)

  const homeroomWrite = await authorizedCall(handler, homeroom, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 1001,
      records: [{ studentId: 101, status: 'PRESENT', note: '' }],
    },
  })
  assert.equal(homeroomWrite.status, 403)
})

test('已取消课次不能继续执行教学写操作', async () => {
  const seed = createBusinessSeed(fixedNow)
  const schedule = seed.schedules.find((item) => item.id === 1001)
  assert.ok(schedule)
  schedule.status = 'CANCELLED'
  seed.scheduleChanges = seed.scheduleChanges.filter(
    (item) => item.scheduleId !== schedule.id,
  )
  const { handler } = setup({ seed })
  const parent = await login(handler, 'parent_201')
  const teacher = await login(handler, 'teacher_301')

  const cases: Array<{
    token: string
    method: string
    url: string
    jsonBody: unknown
  }> = [
    {
      token: parent,
      method: 'POST',
      url: '/parent/leave-requests',
      jsonBody: {
        studentId: 101,
        scheduleId: 1001,
        reason: '请假',
        contactPhone: '13800000001',
      },
    },
    {
      token: teacher,
      method: 'PUT',
      url: '/teacher/attendance',
      jsonBody: {
        scheduleId: 1001,
        records: [{ studentId: 101, status: 'PRESENT', note: '' }],
      },
    },
    {
      token: teacher,
      method: 'POST',
      url: '/teacher/assignments',
      jsonBody: {
        classId: 101,
        courseId: 11,
        scheduleId: 1001,
        title: '取消课次作业',
        description: '不应发布',
        attachments: [],
        dueAt: '2026-08-25T20:00:00+08:00',
        allowLate: false,
      },
    },
    {
      token: teacher,
      method: 'POST',
      url: '/teacher/feedback',
      jsonBody: {
        scheduleId: 1001,
        studentId: 101,
        performance: '表现',
        strengths: '优点',
        improvements: '提升',
        suggestion: '建议',
      },
    },
    {
      token: teacher,
      method: 'POST',
      url: '/teacher/schedule-changes',
      jsonBody: {
        scheduleId: 1001,
        reason: '申请调课',
        proposedDate: '2026-08-22',
        proposedStartTime: '10:00:00',
        proposedEndTime: '11:30:00',
      },
    },
  ]

  for (const item of cases) {
    const response = await authorizedCall(handler, item.token, {
      method: item.method,
      url: item.url,
      jsonBody: item.jsonBody,
    })
    assert.equal(response.status, 409, item.url)
  }
})

test('停用账号不能被安排为代课教师', async () => {
  const seed = createBusinessSeed(fixedNow)
  const teacher = seed.users.find((item) => item.id === 303)
  assert.ok(teacher)
  teacher.active = false
  const { handler } = setup({ seed })
  const academic = await login(handler, 'academic_901')

  const approved = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/review',
    jsonBody: { decision: 'APPROVED', decisionNote: '同意调课' },
  })
  assert.equal(approved.status, 200)

  const assigned = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/substitute',
    jsonBody: { substituteTeacherId: 303, substituteNote: '尝试安排' },
  })
  assert.equal(assigned.status, 404)
})

test('教师提交调课申请时校验时间并阻止重复申请', async () => {
  const { handler } = setup()
  const homeroom = await login(handler, 'teacher_302')

  const invalidTime = await authorizedCall(handler, homeroom, {
    method: 'POST',
    url: '/teacher/schedule-changes',
    jsonBody: {
      scheduleId: 1003,
      reason: '参加教研活动',
      proposedDate: '2026-08-22',
      proposedStartTime: '12:00:00',
      proposedEndTime: '11:00:00',
    },
  })
  assert.equal(invalidTime.status, 422)

  const created = await authorizedCall(handler, homeroom, {
    method: 'POST',
    url: '/teacher/schedule-changes',
    jsonBody: {
      scheduleId: 1003,
      reason: '参加教研活动',
      proposedDate: '2026-08-22',
      proposedStartTime: '10:00:00',
      proposedEndTime: '11:30:00',
      requestedBy: 999,
    },
  })
  assert.equal(created.status, 201)
  assert.equal(parseJsonBody<ScheduleChange>(created).requestedBy, 302)

  const repeated = await authorizedCall(handler, homeroom, {
    method: 'POST',
    url: '/teacher/schedule-changes',
    jsonBody: {
      scheduleId: 1003,
      reason: '重复申请',
      proposedDate: '2026-08-23',
      proposedStartTime: '10:00:00',
      proposedEndTime: '11:30:00',
    },
  })
  assert.equal(repeated.status, 409)
})

test('家长确认反馈不会创建反馈工单', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')
  const academic = await login(handler, 'academic_901')

  const confirmed = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: '/parent/feedback/5001',
    jsonBody: { status: 'CONFIRMED', parentResponse: '忽略此文本' },
  })
  assert.equal(confirmed.status, 200)
  assert.equal(parseJsonBody<StudentFeedback>(confirmed).parentResponse, '')

  const overview = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  assert.equal(parseJsonBody<AdminOverview>(overview).feedbackWorkOrders.length, 0)

  const repeated = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: '/parent/feedback/5001',
    jsonBody: { status: 'CONFIRMED', parentResponse: '' },
  })
  assert.equal(repeated.status, 409)
})

test('家长异议自动生成工单并由教务处理关闭', async () => {
  const { handler } = setup()
  const homeroom = await login(handler, 'teacher_302')
  const parent = await login(handler, 'parent_201')
  const academic = await login(handler, 'academic_901')

  const sent = await authorizedCall(handler, homeroom, {
    method: 'POST',
    url: '/teacher/feedback',
    jsonBody: {
      scheduleId: 1003,
      studentId: 101,
      performance: '朗读认真。',
      strengths: '发音准确。',
      improvements: '语速需要更稳定。',
      suggestion: '每天朗读十分钟。',
    },
  })
  assert.equal(sent.status, 201)
  const feedback = parseJsonBody<StudentFeedback>(sent)

  const emptyDispute = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/feedback/${feedback.id}`,
    jsonBody: { status: 'DISPUTED', parentResponse: '   ' },
  })
  assert.equal(emptyDispute.status, 422)

  const disputed = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/feedback/${feedback.id}`,
    jsonBody: {
      status: 'DISPUTED',
      parentResponse: '课堂记录与实际情况不一致。',
    },
  })
  assert.equal(disputed.status, 200)
  assert.equal(parseJsonBody<StudentFeedback>(disputed).respondedBy, 201)

  const adminResponse = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  const workOrder = parseJsonBody<AdminOverview>(
    adminResponse,
  ).feedbackWorkOrders.find((item) => item.feedbackId === feedback.id)
  assert.ok(workOrder)

  const started = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'START' },
  })
  assert.equal(parseJsonBody<FeedbackWorkOrder>(started).status, 'PROCESSING')

  const missingResult = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'CLOSE', result: '   ' },
  })
  assert.equal(missingResult.status, 422)

  const closed = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'CLOSE', result: '已核对并联系家长。' },
  })
  assert.equal(parseJsonBody<FeedbackWorkOrder>(closed).status, 'CLOSED')

  const repeated = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'CLOSE', result: '重复关闭' },
  })
  assert.equal(repeated.status, 409)
})

test('调课审批和代课生成绑定学生可见通知', async () => {
  const { handler } = setup()
  const academic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')
  const parent = await login(handler, 'parent_201')

  const crossCampus = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7002/review',
    jsonBody: { decision: 'APPROVED', decisionNote: '同意' },
  })
  assert.equal(crossCampus.status, 403)

  const missingReason = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/review',
    jsonBody: { decision: 'REJECTED', decisionNote: '' },
  })
  assert.equal(missingReason.status, 422)

  const approved = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/review',
    jsonBody: { decision: 'APPROVED', decisionNote: '同意调课' },
  })
  assert.equal(parseJsonBody<ScheduleChange>(approved).reviewedBy, 901)

  const originalTeacher = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/substitute',
    jsonBody: { substituteTeacherId: 301, substituteNote: '' },
  })
  assert.equal(originalTeacher.status, 422)

  const timeConflict = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/substitute',
    jsonBody: { substituteTeacherId: 302, substituteNote: '时间冲突' },
  })
  assert.equal(timeConflict.status, 409)

  const assigned = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7001/substitute',
    jsonBody: { substituteTeacherId: 303, substituteNote: '已确认时间' },
  })
  assert.equal(
    parseJsonBody<ScheduleChange>(assigned).status,
    'SUBSTITUTE_ASSIGNED',
  )

  const parentResponse = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students/101/overview',
  })
  const parentOverview = parseJsonBody<ParentOverview>(parentResponse)
  const notice = parentOverview.scheduleChangeNotices.find(
    (item) => item.notification.relatedId === 7001,
  )
  assert.equal(notice?.originalTeacherName, '李老师')
  assert.equal(notice?.substituteTeacherName, '王老师')

  const systemApproved = await authorizedCall(handler, system, {
    method: 'PATCH',
    url: '/admin/schedule-changes/7002/review',
    jsonBody: { decision: 'APPROVED', decisionNote: '系统管理员同意' },
  })
  assert.equal(systemApproved.status, 200)
})

test('教务按校区过滤，系统管理员查看全部校区', async () => {
  const { handler } = setup()
  const academic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')

  const academicResponse = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  const academicOverview = parseJsonBody<AdminOverview>(academicResponse)
  assert.deepEqual(academicOverview.campuses.map((item) => item.id), [1])
  assert.ok(academicOverview.schedules.every((item) => item.campusId === 1))

  const systemResponse = await authorizedCall(handler, system, {
    method: 'GET',
    url: '/admin/overview',
  })
  assert.deepEqual(
    parseJsonBody<AdminOverview>(systemResponse).campuses.map((item) => item.id),
    [1, 2],
  )
})

test('业务路由预检、方法、媒体类型和 JSON 对象边界明确', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_201')

  const preflight = await callHandler(handler, {
    method: 'OPTIONS',
    url: '/parent/leave-requests',
  })
  assert.equal(preflight.status, 204)
  assert.equal(
    preflight.headers.get('access-control-allow-methods'),
    'GET, POST, PUT, PATCH, OPTIONS',
  )

  const wrongMethod = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/leave-requests',
  })
  assert.equal(wrongMethod.status, 405)
  assert.equal(wrongMethod.headers.get('allow'), 'POST, OPTIONS')

  const unsupported = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    rawBody: '{}',
    contentType: 'text/plain',
  })
  assert.equal(unsupported.status, 415)

  const arrayBody = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: [],
  })
  assert.equal(arrayBody.status, 422)

  const unknown = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/unknown',
  })
  assert.equal(unknown.status, 404)
})
