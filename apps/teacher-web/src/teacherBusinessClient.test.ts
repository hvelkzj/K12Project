import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  Assignment,
  AttendanceRecord,
  Courseware,
  FileSummary,
  ScheduleChange,
  StudentFeedback,
  Submission,
} from '@k12/shared'

import {
  createTeacherBusinessClient,
  TeacherBusinessError,
  type TeacherOverview,
} from './teacherBusinessClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function authClient(token: string | null = 'teacher-token') {
  let currentToken = token
  return {
    getAccessToken() {
      return currentToken
    },
    clearAccessToken() {
      currentToken = null
    },
    token() {
      return currentToken
    },
  }
}

function overview(): TeacherOverview {
  return {
    campuses: [{ id: 1, name: '滨江校区' }],
    classes: [{ id: 101, campusId: 1, name: '六年级 1 班' }],
    students: [
      {
        id: 101,
        displayName: '林晓雨',
        classId: 101,
        className: '六年级 1 班',
        campusId: 1,
        campusName: '滨江校区',
      },
    ],
    courses: [{ id: 11, campusId: 1, name: '数学提高班', subject: '数学' }],
    schedules: [
      {
        id: 1001,
        campusId: 1,
        classId: 101,
        courseId: 11,
        teacherId: 301,
        lessonDate: '2026-08-20',
        startTime: '09:00:00',
        endTime: '10:30:00',
        room: 'A-302',
        status: 'SCHEDULED',
      },
    ],
    attendance: [],
    courseware: [],
    assignments: [],
    submissions: [],
    feedback: [],
    scheduleChanges: [],
    leaveRequests: [],
  }
}

test('教师概览使用 Bearer token 和规范化 API 地址', async () => {
  const auth = authClient()
  const client = createTeacherBusinessClient({
    apiBaseUrl: 'http://api.test/',
    authClient: auth,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://api.test/teacher/overview')
      assert.equal(init?.method, undefined)
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer teacher-token',
      )
      return jsonResponse(overview())
    },
  })

  assert.equal((await client.loadOverview()).schedules[0]?.id, 1001)
})

test('教师可以上传发布附件并下载学生提交附件', async () => {
  const uploaded: FileSummary = {
    id: 10_001,
    originalName: '作业要求.pdf',
    mimeType: 'application/pdf',
    byteSize: 7,
    createdAt: '2026-08-24T02:00:00.000Z',
  }
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const client = createTeacherBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: authClient(),
    fetchImpl: async (input, init) => {
      const url = String(input)
      calls.push({ url, init })
      return url.includes('/teacher/files')
        ? jsonResponse(uploaded, 201)
        : new Response('student-file', { status: 200 })
    },
  })
  const file = new File(['content'], '作业要求.pdf', {
    type: 'application/pdf',
  })

  assert.deepEqual(await client.uploadFile(file), uploaded)
  assert.equal(await (await client.downloadFile(10_002)).text(), 'student-file')
  assert.equal(
    calls[0]?.url,
    'http://api.test/teacher/files?name=%E4%BD%9C%E4%B8%9A%E8%A6%81%E6%B1%82.pdf',
  )
  assert.equal(calls[0]?.init?.body, file)
  assert.equal(
    new Headers(calls[0]?.init?.headers).get('Content-Type'),
    'application/pdf',
  )
  assert.equal(calls[1]?.url, 'http://api.test/files/10002')
  assert.equal(
    new Headers(calls[1]?.init?.headers).get('Authorization'),
    'Bearer teacher-token',
  )
})

test('五个教师写接口发送正确方法与请求体', async (context) => {
  const attendance: AttendanceRecord[] = [
    {
      id: 10001,
      scheduleId: 1001,
      studentId: 101,
      status: 'PRESENT',
      note: '',
      recordedBy: 301,
      recordedAt: '2026-08-20T09:00:00+08:00',
    },
  ]
  const assignment: Assignment = {
    id: 3001,
    campusId: 1,
    classId: 101,
    courseId: 11,
    scheduleId: 1001,
    teacherId: 301,
    title: '作业',
    description: '完成练习',
    attachments: [],
    dueAt: '2026-08-21T20:00:00+08:00',
    allowLate: false,
    publishedAt: '2026-08-20T10:00:00+08:00',
    createdAt: '2026-08-20T10:00:00+08:00',
    updatedAt: '2026-08-20T10:00:00+08:00',
  }
  const submission: Submission = {
    id: 4001,
    assignmentId: 3001,
    studentId: 101,
    attempt: 1,
    content: '已完成',
    attachments: [],
    status: 'GRADED',
    submittedAt: '2026-08-20T11:00:00+08:00',
    score: 95,
    teacherComment: '很好',
    gradedBy: 301,
    gradedAt: '2026-08-20T12:00:00+08:00',
    updatedAt: '2026-08-20T12:00:00+08:00',
  }
  const feedback: StudentFeedback = {
    id: 5001,
    campusId: 1,
    scheduleId: 1001,
    studentId: 101,
    teacherId: 301,
    performance: '认真',
    strengths: '计算准确',
    improvements: '审题',
    suggestion: '复习',
    status: 'PENDING_PARENT',
    parentResponse: '',
    sentAt: '2026-08-20T12:00:00+08:00',
    updatedAt: '2026-08-20T12:00:00+08:00',
  }
  const change: ScheduleChange = {
    id: 7001,
    campusId: 1,
    scheduleId: 1001,
    requestedBy: 301,
    reason: '教研活动',
    originalTeacherId: 301,
    originalDate: '2026-08-20',
    originalStartTime: '09:00:00',
    originalEndTime: '10:30:00',
    proposedDate: '2026-08-21',
    proposedStartTime: '10:00:00',
    proposedEndTime: '11:30:00',
    status: 'PENDING',
    decisionNote: '',
    substituteNote: '',
    createdAt: '2026-08-20T12:00:00+08:00',
    updatedAt: '2026-08-20T12:00:00+08:00',
  }

  const scenarios = [
    {
      name: '签到',
      path: '/teacher/attendance',
      method: 'PUT',
      body: {
        scheduleId: 1001,
        records: [{ studentId: 101, status: 'PRESENT', note: '' }],
      },
      response: attendance,
      run: (client: ReturnType<typeof createTeacherBusinessClient>) =>
        client.saveAttendance({
          scheduleId: 1001,
          records: [{ studentId: 101, status: 'PRESENT', note: '' }],
        }),
    },
    {
      name: '发布作业',
      path: '/teacher/assignments',
      method: 'POST',
      body: {
        classId: 101,
        courseId: 11,
        scheduleId: 1001,
        title: '作业',
        description: '完成练习',
        attachments: [],
        dueAt: '2026-08-21T20:00:00+08:00',
        allowLate: false,
      },
      response: assignment,
      run: (client: ReturnType<typeof createTeacherBusinessClient>) =>
        client.publishAssignment({
          classId: 101,
          courseId: 11,
          scheduleId: 1001,
          title: '作业',
          description: '完成练习',
          attachments: [],
          dueAt: '2026-08-21T20:00:00+08:00',
          allowLate: false,
        }),
    },
    {
      name: '批改',
      path: '/teacher/submissions/4001',
      method: 'PATCH',
      body: {
        score: 95,
        teacherComment: '很好',
        correctionRequired: false,
      },
      response: submission,
      run: (client: ReturnType<typeof createTeacherBusinessClient>) =>
        client.gradeSubmission(4001, {
          score: 95,
          teacherComment: '很好',
          correctionRequired: false,
        }),
    },
    {
      name: '反馈',
      path: '/teacher/feedback',
      method: 'POST',
      body: {
        scheduleId: 1001,
        studentId: 101,
        performance: '认真',
        strengths: '计算准确',
        improvements: '审题',
        suggestion: '复习',
      },
      response: feedback,
      run: (client: ReturnType<typeof createTeacherBusinessClient>) =>
        client.sendFeedback({
          scheduleId: 1001,
          studentId: 101,
          performance: '认真',
          strengths: '计算准确',
          improvements: '审题',
          suggestion: '复习',
        }),
    },
    {
      name: '调课',
      path: '/teacher/schedule-changes',
      method: 'POST',
      body: {
        scheduleId: 1001,
        reason: '教研活动',
        proposedDate: '2026-08-21',
        proposedStartTime: '10:00:00',
        proposedEndTime: '11:30:00',
      },
      response: change,
      run: (client: ReturnType<typeof createTeacherBusinessClient>) =>
        client.requestScheduleChange({
          scheduleId: 1001,
          reason: '教研活动',
          proposedDate: '2026-08-21',
          proposedStartTime: '10:00:00',
          proposedEndTime: '11:30:00',
        }),
    },
  ]

  for (const scenario of scenarios) {
    await context.test(scenario.name, async () => {
      const client = createTeacherBusinessClient({
        apiBaseUrl: 'http://api.test',
        authClient: authClient(),
        fetchImpl: async (url, init) => {
          assert.equal(url, `http://api.test${scenario.path}`)
          assert.equal(init?.method, scenario.method)
          assert.deepEqual(JSON.parse(String(init?.body)), scenario.body)
          return jsonResponse(scenario.response)
        },
      })
      await scenario.run(client)
    })
  }
})

test('教师发布课件发送班级、课程、内容和附件', async () => {
  const material: Courseware = {
    id: 2004,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    title: '分数专题',
    description: '课堂讲义',
    attachments: [],
    publishedAt: '2026-08-25T02:00:00.000Z',
  }
  let requestBody = ''
  const client = createTeacherBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: authClient(),
    fetchImpl: async (input, init) => {
      assert.equal(String(input), 'http://api.test/teacher/courseware')
      assert.equal(init?.method, 'POST')
      requestBody = String(init?.body)
      return jsonResponse(material, 201)
    },
  })
  assert.deepEqual(
    await client.publishCourseware({
      classId: 101,
      courseId: 11,
      title: '分数专题',
      description: '课堂讲义',
      attachments: [],
    }),
    material,
  )
  assert.deepEqual(JSON.parse(requestBody), {
    classId: 101,
    courseId: 11,
    title: '分数专题',
    description: '课堂讲义',
    attachments: [],
  })
})

test('无 token 时不发送请求并返回 401', async () => {
  let called = false
  const client = createTeacherBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: authClient(null),
    fetchImpl: async () => {
      called = true
      return jsonResponse(overview())
    },
  })

  await assert.rejects(
    () => client.loadOverview(),
    (error: unknown) =>
      error instanceof TeacherBusinessError &&
      error.status === 401 &&
      error.code === 'AUTH_REQUIRED',
  )
  assert.equal(called, false)
})

test('401 清除 token，403 与 409 保留服务端错误', async (context) => {
  for (const scenario of [
    { status: 401, code: 'INVALID_SESSION', message: '登录已失效' },
    { status: 403, code: 'FORBIDDEN', message: '只能操作本人课程' },
    { status: 409, code: 'CONFLICT', message: '不能重复签到' },
  ]) {
    await context.test(String(scenario.status), async () => {
      const auth = authClient()
      const client = createTeacherBusinessClient({
        apiBaseUrl: 'http://api.test',
        authClient: auth,
        fetchImpl: async () => jsonResponse(scenario, scenario.status),
      })

      await assert.rejects(
        () => client.loadOverview(),
        (error: unknown) =>
          error instanceof TeacherBusinessError &&
          error.status === scenario.status &&
          error.code === scenario.code &&
          error.message === scenario.message,
      )
      assert.equal(auth.token(), scenario.status === 401 ? null : 'teacher-token')
    })
  }
})

test('网络错误转换为稳定的 NETWORK_ERROR', async () => {
  const client = createTeacherBusinessClient({
    apiBaseUrl: 'http://api.test',
    authClient: authClient(),
    fetchImpl: async () => {
      throw new Error('连接失败')
    },
  })

  await assert.rejects(
    () => client.loadOverview(),
    (error: unknown) =>
      error instanceof TeacherBusinessError &&
      error.status === 0 &&
      error.code === 'NETWORK_ERROR' &&
      error.message === '网络请求失败，请稍后重试',
  )
})
