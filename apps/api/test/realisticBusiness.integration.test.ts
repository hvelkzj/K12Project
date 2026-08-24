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
  ScheduleSummary,
  StudentFeedback,
  Submission,
} from '@k12/shared'
import {
  MOCK_ACCOUNTS,
  MOCK_ACCOUNT_PASSWORD,
} from '@k12/shared/mock-accounts'

import { createRequestHandler } from '../src/app.js'
import { createAuthService } from '../src/authService.js'
import { createBusinessSeed } from '../src/businessSeed.js'
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

const fixedNow = Date.parse('2026-08-24T10:00:00+08:00')

function setup() {
  let tokenNumber = 0
  const now = () => fixedNow
  const authService = createAuthService({
    now,
    createToken: () => `realistic-token-${++tokenNumber}`,
  })
  const businessStore = createBusinessStore({ now })
  return { handler: createRequestHandler(authService, businessStore) }
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
  assert.equal(response.status, 200, `${username} 应当可以登录`)
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

test('初始业务数据保持账号、校区、班级和业务记录引用完整', () => {
  const seed = createBusinessSeed(fixedNow)
  const accountById = new Map(MOCK_ACCOUNTS.map((item) => [item.user.id, item]))
  const userById = new Map(seed.users.map((item) => [item.id, item]))
  const studentById = new Map(seed.students.map((item) => [item.id, item]))
  const classById = new Map(seed.classes.map((item) => [item.id, item]))
  const courseById = new Map(seed.courses.map((item) => [item.id, item]))
  const scheduleById = new Map(seed.schedules.map((item) => [item.id, item]))
  const assignmentById = new Map(seed.assignments.map((item) => [item.id, item]))
  const feedbackById = new Map(seed.feedback.map((item) => [item.id, item]))

  assert.equal(seed.users.length, MOCK_ACCOUNTS.length)
  assert.deepEqual(
    seed.users.map((item) => item.username),
    MOCK_ACCOUNTS.map((item) => item.username),
  )

  for (const user of seed.users) {
    const account = accountById.get(user.id)
    assert.ok(account, `业务账号 ${user.username} 必须可以登录`)
    assert.equal(account.user.role, user.role)
    assert.equal(account.user.campusId, user.campusId)
  }

  for (const classRecord of seed.classes) {
    const homeroom = userById.get(classRecord.homeroomTeacherId)
    assert.ok(homeroom, `班级 ${classRecord.name} 必须有班主任`)
    assert.equal(homeroom.role, 'HOMEROOM_TEACHER')
    assert.equal(homeroom.campusId, classRecord.campusId)
  }

  for (const student of seed.students) {
    assert.equal(userById.get(student.id)?.role, 'STUDENT')
    assert.equal(classById.get(student.classId)?.campusId, student.campusId)
  }

  for (const binding of seed.parentBindings) {
    assert.equal(userById.get(binding.parentId)?.role, 'PARENT')
    assert.deepEqual(studentById.get(binding.student.id), binding.student)
  }

  for (const schedule of seed.schedules) {
    const teacher = userById.get(schedule.teacherId)
    assert.ok(
      teacher?.role === 'TEACHER' || teacher?.role === 'HOMEROOM_TEACHER',
    )
    assert.equal(teacher.campusId, schedule.campusId)
    assert.equal(classById.get(schedule.classId)?.campusId, schedule.campusId)
    assert.equal(courseById.get(schedule.courseId)?.campusId, schedule.campusId)
  }

  for (const assignment of seed.assignments) {
    assert.equal(classById.get(assignment.classId)?.campusId, assignment.campusId)
    assert.equal(courseById.get(assignment.courseId)?.campusId, assignment.campusId)
    assert.equal(scheduleById.get(assignment.scheduleId ?? -1)?.classId, assignment.classId)
    assert.equal(userById.get(assignment.teacherId)?.campusId, assignment.campusId)
  }

  const submissionKeys = new Set<string>()
  for (const submission of seed.submissions) {
    const assignment = assignmentById.get(submission.assignmentId)
    const student = studentById.get(submission.studentId)
    assert.ok(assignment)
    assert.ok(student)
    assert.equal(student.classId, assignment.classId)
    const key = `${submission.assignmentId}:${submission.studentId}:${submission.attempt}`
    assert.equal(submissionKeys.has(key), false)
    submissionKeys.add(key)
  }

  for (const workOrder of seed.workOrders) {
    const feedback = feedbackById.get(workOrder.feedbackId)
    assert.equal(feedback?.status, 'DISPUTED')
    assert.equal(feedback?.campusId, workOrder.campusId)
    assert.equal(feedback?.parentResponse, workOrder.issue)
  }

  for (const campus of seed.campuses) {
    assert.ok(seed.classes.some((item) => item.campusId === campus.id))
    assert.ok(seed.students.some((item) => item.campusId === campus.id))
    assert.ok(seed.courses.some((item) => item.campusId === campus.id))
    assert.ok(seed.schedules.some((item) => item.campusId === campus.id))
    assert.ok(
      seed.users.some(
        (item) =>
          item.campusId === campus.id && item.role === 'ACADEMIC_ADMIN',
      ),
    )
  }
})

test('第二校区六角色完成请假、签到、作业、反馈和调课闭环', async () => {
  const { handler } = setup()
  const parent = await login(handler, 'parent_202')
  const otherParent = await login(handler, 'parent_201')
  const student = await login(handler, 'student_103')
  const teacher = await login(handler, 'teacher_401')
  const homeroom = await login(handler, 'teacher_402')
  const academic = await login(handler, 'academic_902')
  const otherAcademic = await login(handler, 'academic_901')
  const system = await login(handler, 'system_999')

  const bindingsResponse = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students',
  })
  assert.deepEqual(
    parseJsonBody<ParentStudentBinding[]>(bindingsResponse).map(
      (item) => item.student.id,
    ),
    [103],
  )

  const unbound = await authorizedCall(handler, otherParent, {
    method: 'GET',
    url: '/parent/students/103/overview',
  })
  assert.equal(unbound.status, 403)

  const studentOverviewResponse = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  const studentOverview = parseJsonBody<StudentOverview>(studentOverviewResponse)
  assert.equal(studentOverview.student.campusId, 2)
  assert.ok(studentOverview.courseware.some((item) => item.id === 2003))
  assert.ok(studentOverview.assignments.some((item) => item.id === 3005))
  assert.ok(studentOverview.submissions.some((item) => item.id === 4005))

  const teacherOverviewResponse = await authorizedCall(handler, teacher, {
    method: 'GET',
    url: '/teacher/overview',
  })
  const teacherOverview = parseJsonBody<TeacherOverview>(teacherOverviewResponse)
  assert.deepEqual(teacherOverview.campuses.map((item) => item.id), [2])
  assert.deepEqual(teacherOverview.students.map((item) => item.id), [103])

  const homeroomOverviewResponse = await authorizedCall(handler, homeroom, {
    method: 'GET',
    url: '/teacher/overview',
  })
  assert.deepEqual(
    parseJsonBody<TeacherOverview>(homeroomOverviewResponse).classes.map(
      (item) => item.id,
    ),
    [201],
  )

  const academicOverviewResponse = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  assert.deepEqual(
    parseJsonBody<AdminOverview>(academicOverviewResponse).campuses.map(
      (item) => item.id,
    ),
    [2],
  )
  const systemOverviewResponse = await authorizedCall(handler, system, {
    method: 'GET',
    url: '/admin/overview',
  })
  assert.deepEqual(
    parseJsonBody<AdminOverview>(systemOverviewResponse).campuses.map(
      (item) => item.id,
    ),
    [1, 2],
  )

  const leaveResponse = await authorizedCall(handler, parent, {
    method: 'POST',
    url: '/parent/leave-requests',
    jsonBody: {
      studentId: 103,
      scheduleId: 2001,
      reason: '上午就医，需要请假',
      contactPhone: '13800000202',
    },
  })
  assert.equal(leaveResponse.status, 201)
  const leave = parseJsonBody<LeaveRequest>(leaveResponse)

  const crossCampusReview = await authorizedCall(handler, otherAcademic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${leave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '越权审批' },
  })
  assert.equal(crossCampusReview.status, 403)
  assert.equal(parseJsonBody<ApiError>(crossCampusReview).code, 'FORBIDDEN')

  const approvedLeave = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/leave-requests/${leave.id}/review`,
    jsonBody: { decision: 'APPROVED', reviewNote: '家长已电话确认' },
  })
  assert.equal(parseJsonBody<LeaveRequest>(approvedLeave).status, 'APPROVED')

  const invalidAttendance = await authorizedCall(handler, teacher, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 2001,
      records: [{ studentId: 103, status: 'PRESENT', note: '' }],
    },
  })
  assert.equal(invalidAttendance.status, 422)

  const attendanceResponse = await authorizedCall(handler, teacher, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 2001,
      records: [{ studentId: 103, status: 'LEAVE', note: '请假已批准' }],
    },
  })
  assert.equal(
    parseJsonBody<AttendanceRecord[]>(attendanceResponse)[0]?.status,
    'LEAVE',
  )

  const forbiddenHomeroomWrite = await authorizedCall(handler, homeroom, {
    method: 'PUT',
    url: '/teacher/attendance',
    jsonBody: {
      scheduleId: 2001,
      records: [{ studentId: 103, status: 'LEAVE', note: '' }],
    },
  })
  assert.equal(forbiddenHomeroomWrite.status, 403)

  const assignmentResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 201,
      courseId: 13,
      scheduleId: 2001,
      title: '水循环课堂总结',
      description: '用自己的话说明水循环三个阶段。',
      attachments: [],
      dueAt: '2026-08-28T20:00:00+08:00',
      allowLate: false,
    },
  })
  assert.equal(assignmentResponse.status, 201)
  const assignment = parseJsonBody<Assignment>(assignmentResponse)

  const submissionResponse = await authorizedCall(handler, student, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '水先蒸发成为水蒸气，再凝结形成小水滴，最后以降水回到地面。',
      attachments: [],
    },
  })
  assert.equal(submissionResponse.status, 201)
  const submission = parseJsonBody<Submission>(submissionResponse)

  const gradeResponse = await authorizedCall(handler, teacher, {
    method: 'PATCH',
    url: `/teacher/submissions/${submission.id}`,
    jsonBody: {
      score: 95,
      teacherComment: '表述完整，三个阶段关系清楚。',
      correctionRequired: false,
    },
  })
  assert.equal(parseJsonBody<Submission>(gradeResponse).status, 'GRADED')

  const gradedOverviewResponse = await authorizedCall(handler, student, {
    method: 'GET',
    url: '/student/overview',
  })
  const gradedSubmission = parseJsonBody<StudentOverview>(gradedOverviewResponse)
    .submissions.find((item) => item.id === submission.id)
  assert.equal(gradedSubmission?.score, 95)

  const feedbackResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/feedback',
    jsonBody: {
      scheduleId: 2001,
      studentId: 103,
      performance: '课堂讨论积极，能够联系实验现象。',
      strengths: '观察细致，结论表达完整。',
      improvements: '书面记录可以再简洁一些。',
      suggestion: '继续用图示整理科学过程。',
    },
  })
  assert.equal(feedbackResponse.status, 201)
  const feedback = parseJsonBody<StudentFeedback>(feedbackResponse)

  const disputeResponse = await authorizedCall(handler, parent, {
    method: 'PATCH',
    url: `/parent/feedback/${feedback.id}`,
    jsonBody: {
      status: 'DISPUTED',
      parentResponse: '希望老师补充说明书面记录需要改进的具体位置。',
    },
  })
  assert.equal(parseJsonBody<StudentFeedback>(disputeResponse).status, 'DISPUTED')

  const workOrderOverviewResponse = await authorizedCall(handler, academic, {
    method: 'GET',
    url: '/admin/overview',
  })
  const workOrder = parseJsonBody<AdminOverview>(workOrderOverviewResponse)
    .feedbackWorkOrders.find((item) => item.feedbackId === feedback.id)
  assert.ok(workOrder)

  const started = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: { action: 'START' },
  })
  assert.equal(parseJsonBody<FeedbackWorkOrder>(started).status, 'PROCESSING')

  const closed = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/work-orders/${workOrder.id}`,
    jsonBody: {
      action: 'CLOSE',
      result: '任课教师已补充标注，家长确认收到说明。',
    },
  })
  assert.equal(parseJsonBody<FeedbackWorkOrder>(closed).status, 'CLOSED')

  const scheduleResponse = await authorizedCall(handler, academic, {
    method: 'POST',
    url: '/admin/schedules',
    jsonBody: {
      campusId: 2,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      lessonDate: '2026-08-27',
      startTime: '14:00:00',
      endTime: '15:30:00',
      room: 'C-202',
    },
  })
  assert.equal(scheduleResponse.status, 201)
  const schedule = parseJsonBody<ScheduleSummary>(scheduleResponse)

  const changeResponse = await authorizedCall(handler, teacher, {
    method: 'POST',
    url: '/teacher/schedule-changes',
    jsonBody: {
      scheduleId: schedule.id,
      reason: '参加区级科学教研活动',
      proposedDate: '2026-08-28',
      proposedStartTime: '14:00:00',
      proposedEndTime: '15:30:00',
    },
  })
  assert.equal(changeResponse.status, 201)
  const change = parseJsonBody<ScheduleChange>(changeResponse)

  const reviewChange = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/review`,
    jsonBody: { decision: 'APPROVED', decisionNote: '教研安排已核实' },
  })
  assert.equal(parseJsonBody<ScheduleChange>(reviewChange).status, 'APPROVED')

  const substituteResponse = await authorizedCall(handler, academic, {
    method: 'PATCH',
    url: `/admin/schedule-changes/${change.id}/substitute`,
    jsonBody: {
      substituteTeacherId: 402,
      substituteNote: '班主任已确认代课时间',
    },
  })
  assert.equal(
    parseJsonBody<ScheduleChange>(substituteResponse).status,
    'SUBSTITUTE_ASSIGNED',
  )

  const parentOverviewResponse = await authorizedCall(handler, parent, {
    method: 'GET',
    url: '/parent/students/103/overview',
  })
  const notice = parseJsonBody<ParentOverview>(parentOverviewResponse)
    .scheduleChangeNotices.find(
      (item) => item.notification.relatedId === change.id,
    )
  assert.equal(notice?.originalTeacherName, '陈老师')
  assert.equal(notice?.substituteTeacherName, '赵老师')
})
