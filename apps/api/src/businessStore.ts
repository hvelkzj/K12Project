import type {
  Assignment,
  AttendanceRecord,
  AttendanceStatus,
  ClassSummary,
  FileSummary,
  LeaveRequest,
  ScheduleChange,
  ScheduleSummary,
  StudentFeedback,
  Submission,
  UserAccountSummary,
  UserRole,
  UserSummary,
} from '@k12/shared'
import { ATTENDANCE_STATUSES } from '@k12/shared'

import {
  createBusinessSeed,
  type BusinessSeed,
  type ClassRecord,
} from './businessSeed.js'
import type {
  AdminOverview,
  BusinessInput,
  BusinessStore,
  ParentOverview,
  StudentOverview,
  TeacherOverview,
} from './businessTypes.js'

const allowedAttachmentTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])
const maximumAttachmentBytes = 10 * 1024 * 1024

export class BusinessError extends Error {
  constructor(
    readonly status: 403 | 404 | 409 | 422,
    readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message)
    this.name = 'BusinessError'
  }
}

export interface BusinessStoreOptions {
  now?: () => number
  seed?: BusinessSeed
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function forbidden(message: string): never {
  throw new BusinessError(403, 'FORBIDDEN', message)
}

function notFound(message: string): never {
  throw new BusinessError(404, 'NOT_FOUND', message)
}

function conflict(message: string): never {
  throw new BusinessError(409, 'CONFLICT', message)
}

function invalid(message: string): never {
  throw new BusinessError(422, 'VALIDATION_ERROR', message)
}

function requireRole(user: UserSummary, roles: readonly UserRole[]): void {
  if (!roles.includes(user.role)) {
    forbidden('当前角色不能访问该接口')
  }
}

function requirePositiveInteger(input: BusinessInput, field: string): number {
  const value = input[field]
  if (!Number.isInteger(value) || (value as number) <= 0) {
    invalid(`${field} 必须是正整数`)
  }
  return value as number
}

function optionalPositiveInteger(
  input: BusinessInput,
  field: string,
): number | null {
  const value = input[field]
  if (value === undefined || value === null) return null
  if (!Number.isInteger(value) || (value as number) <= 0) {
    invalid(`${field} 必须是正整数或 null`)
  }
  return value as number
}

function requireString(input: BusinessInput, field: string): string {
  const value = input[field]
  if (typeof value !== 'string') invalid(`${field} 必须是字符串`)
  return value as string
}

function requireText(input: BusinessInput, field: string): string {
  const value = requireString(input, field).trim()
  if (!value) invalid(`${field} 不能为空`)
  return value
}

function requireBoolean(input: BusinessInput, field: string): boolean {
  const value = input[field]
  if (typeof value !== 'boolean') invalid(`${field} 必须是布尔值`)
  return value as boolean
}

function requireNumber(input: BusinessInput, field: string): number {
  const value = input[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(`${field} 必须是有效数字`)
  }
  return value as number
}

function requireDate(input: BusinessInput, field: string): string {
  const value = requireText(input, field)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    invalid(`${field} 必须使用 YYYY-MM-DD`)
  }
  const parsed = new Date(`${value}T00:00:00+08:00`)
  const normalized = new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  if (!Number.isFinite(parsed.getTime()) || normalized !== value) {
    invalid(`${field} 必须是有效日期`)
  }
  return value
}

function requireTime(input: BusinessInput, field: string): string {
  const value = requireText(input, field)
  if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)) {
    invalid(`${field} 必须使用 HH:mm:ss`)
  }
  return value
}

function requireIsoTimestamp(input: BusinessInput, field: string): string {
  const value = requireText(input, field)
  if (!Number.isFinite(Date.parse(value)) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    invalid(`${field} 必须是带时区的 ISO 8601 时间`)
  }
  return value
}

function requireFiles(input: BusinessInput, field: string): FileSummary[] {
  const value = input[field]
  if (!Array.isArray(value)) invalid(`${field} 必须是数组`)

  return (value as unknown[]).map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalid(`${field}[${index}] 必须是对象`)
    }
    const candidate = item as BusinessInput
    const file: FileSummary = {
      id: requirePositiveInteger(candidate, 'id'),
      originalName: requireText(candidate, 'originalName'),
      mimeType: requireText(candidate, 'mimeType'),
      byteSize: requirePositiveInteger(candidate, 'byteSize'),
      createdAt: requireIsoTimestamp(candidate, 'createdAt'),
    }

    if (!allowedAttachmentTypes.has(file.mimeType)) {
      invalid('附件仅支持 PDF、DOCX、JPG 或 PNG')
    }
    if (file.byteSize > maximumAttachmentBytes) {
      invalid('单个附件不能超过 10 MB')
    }
    return file
  })
}

function nextId<T extends { id: number }>(items: readonly T[], minimum: number): number {
  return Math.max(minimum - 1, ...items.map((item) => item.id)) + 1
}

function timeInSeconds(time: string): number {
  const [hour = 0, minute = 0, second = 0] = time.split(':').map(Number)
  return hour * 3600 + minute * 60 + second
}

function overlaps(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
): boolean {
  return (
    timeInSeconds(firstStart) < timeInSeconds(secondEnd) &&
    timeInSeconds(secondStart) < timeInSeconds(firstEnd)
  )
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)]
}

function publicUser(user: UserAccountSummary): UserSummary {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    campusId: user.campusId,
    campusName: user.campusName,
  }
}

function publicClass(item: ClassRecord): ClassSummary {
  return {
    id: item.id,
    campusId: item.campusId,
    name: item.name,
  }
}

export function createBusinessStore(
  options: BusinessStoreOptions = {},
): BusinessStore {
  const now = options.now ?? Date.now
  const initialData = () => clone(options.seed ?? createBusinessSeed(now()))
  let data = initialData()

  function currentIso(): string {
    return new Date(now()).toISOString()
  }

  function findStudent(studentId: number) {
    const student = data.students.find((item) => item.id === studentId)
    if (!student) notFound('学生不存在')
    return student
  }

  function findSchedule(scheduleId: number): ScheduleSummary {
    const schedule = data.schedules.find((item) => item.id === scheduleId)
    if (!schedule) notFound('课次不存在')
    return schedule
  }

  function findClass(classId: number): ClassRecord {
    const classRecord = data.classes.find((item) => item.id === classId)
    if (!classRecord) notFound('班级不存在')
    return classRecord
  }

  function ensureParentBinding(parentId: number, studentId: number) {
    const binding = data.parentBindings.find(
      (item) => item.parentId === parentId && item.student.id === studentId,
    )
    if (!binding) forbidden('家长只能访问已绑定学生的数据')
    return binding
  }

  function ensureTeachingSchedule(user: UserSummary, scheduleId: number) {
    requireRole(user, ['TEACHER', 'HOMEROOM_TEACHER'])
    const schedule = findSchedule(scheduleId)
    if (schedule.teacherId !== user.id) {
      forbidden('教师只能写入本人授课课次的数据')
    }
    return schedule
  }

  function ensureAdmin(user: UserSummary): void {
    requireRole(user, ['ACADEMIC_ADMIN', 'SYSTEM_ADMIN'])
  }

  function ensureAdminCampus(user: UserSummary, campusId: number): void {
    ensureAdmin(user)
    if (user.role === 'ACADEMIC_ADMIN' && user.campusId !== campusId) {
      forbidden('教务只能访问所属校区的数据')
    }
  }

  function visibleTeacherClassIds(user: UserSummary): number[] {
    requireRole(user, ['TEACHER', 'HOMEROOM_TEACHER'])
    const ownClassIds = data.schedules
      .filter((schedule) => schedule.teacherId === user.id)
      .map((schedule) => schedule.classId)
    const homeroomClassIds =
      user.role === 'HOMEROOM_TEACHER'
        ? data.classes
            .filter((item) => item.homeroomTeacherId === user.id)
            .map((item) => item.id)
        : []
    return uniqueNumbers([...ownClassIds, ...homeroomClassIds])
  }

  function parentOverview(user: UserSummary, studentId: number): ParentOverview {
    requireRole(user, ['PARENT'])
    const binding = ensureParentBinding(user.id, studentId)
    const student = binding.student
    const schedules = data.schedules.filter(
      (schedule) => schedule.classId === student.classId,
    )
    const feedback = data.feedback.filter((item) => item.studentId === studentId)
    const courseIds = uniqueNumbers(schedules.map((item) => item.courseId))
    const teacherIds = uniqueNumbers([
      ...schedules.map((item) => item.teacherId),
      ...feedback.map((item) => item.teacherId),
    ])

    return clone({
      student,
      schedules,
      courses: data.courses.filter((item) => courseIds.includes(item.id)),
      teachers: data.users
        .filter((item) => teacherIds.includes(item.id))
        .map(publicUser),
      leaveRequests: data.leaveRequests.filter(
        (item) => item.parentId === user.id && item.studentId === studentId,
      ),
      notifications: data.notifications.filter(
        (item) =>
          item.userId === user.id &&
          (item.studentId === studentId || item.studentId == null),
      ),
      scheduleChangeNotices: data.scheduleChangeNotices.filter(
        (item) =>
          item.notification.userId === user.id &&
          item.notification.studentId === studentId,
      ),
      feedback,
    })
  }

  function studentOverview(user: UserSummary): StudentOverview {
    requireRole(user, ['STUDENT'])
    const student = findStudent(user.id)
    const assignments = data.assignments.filter(
      (item) => item.classId === student.classId,
    )
    const courseware = data.courseware.filter(
      (item) => item.classId === student.classId,
    )
    const courseIds = uniqueNumbers([
      ...assignments.map((item) => item.courseId),
      ...courseware.map((item) => item.courseId),
    ])
    const teacherIds = uniqueNumbers([
      ...assignments.map((item) => item.teacherId),
      ...courseware.map((item) => item.teacherId),
    ])

    return clone({
      student,
      courses: data.courses.filter((item) => courseIds.includes(item.id)),
      teachers: data.users
        .filter((item) => teacherIds.includes(item.id))
        .map(publicUser),
      courseware,
      assignments,
      submissions: data.submissions.filter((item) => item.studentId === user.id),
    })
  }

  function teacherOverview(user: UserSummary): TeacherOverview {
    const classIds = visibleTeacherClassIds(user)
    const schedules = data.schedules.filter((item) => {
      if (item.teacherId === user.id) return true
      return user.role === 'HOMEROOM_TEACHER' && classIds.includes(item.classId)
    })
    const assignments = data.assignments.filter((item) => {
      if (item.teacherId === user.id) return true
      return user.role === 'HOMEROOM_TEACHER' && classIds.includes(item.classId)
    })
    const assignmentIds = assignments.map((item) => item.id)
    const scheduleIds = schedules.map((item) => item.id)

    return clone({
      campuses: data.campuses.filter((item) => item.id === user.campusId),
      classes: data.classes
        .filter((item) => classIds.includes(item.id))
        .map(publicClass),
      students: data.students.filter((item) => classIds.includes(item.classId)),
      courses: data.courses.filter((item) => item.campusId === user.campusId),
      schedules,
      attendance: data.attendance.filter((item) =>
        scheduleIds.includes(item.scheduleId),
      ),
      assignments,
      submissions: data.submissions.filter((item) =>
        assignmentIds.includes(item.assignmentId),
      ),
      feedback: data.feedback.filter((item) =>
        classIds.includes(findStudent(item.studentId).classId),
      ),
      scheduleChanges: data.scheduleChanges.filter(
        (item) =>
          item.requestedBy === user.id || scheduleIds.includes(item.scheduleId),
      ),
    })
  }

  function adminOverview(user: UserSummary): AdminOverview {
    ensureAdmin(user)
    const campusAllowed = (campusId: number) =>
      user.role === 'SYSTEM_ADMIN' || campusId === user.campusId
    const users = data.users.filter((item) => campusAllowed(item.campusId))

    return clone({
      campuses: data.campuses.filter((item) => campusAllowed(item.id)),
      classes: data.classes
        .filter((item) => campusAllowed(item.campusId))
        .map(publicClass),
      courses: data.courses.filter((item) => campusAllowed(item.campusId)),
      schedules: data.schedules.filter((item) => campusAllowed(item.campusId)),
      users,
      teachers: users
        .filter(
          (item) =>
            item.role === 'TEACHER' || item.role === 'HOMEROOM_TEACHER',
        )
        .map(publicUser),
      scheduleChanges: data.scheduleChanges.filter((item) =>
        campusAllowed(item.campusId),
      ),
      feedbackWorkOrders: data.workOrders.filter((item) =>
        campusAllowed(item.campusId),
      ),
    })
  }

  return {
    listParentStudents(user) {
      requireRole(user, ['PARENT'])
      return clone(
        data.parentBindings.filter((binding) => binding.parentId === user.id),
      )
    },

    getParentOverview(user, studentId) {
      return parentOverview(user, studentId)
    },

    submitLeaveRequest(user, input) {
      requireRole(user, ['PARENT'])
      const studentId = requirePositiveInteger(input, 'studentId')
      const scheduleId = requirePositiveInteger(input, 'scheduleId')
      const reason = requireText(input, 'reason')
      const contactPhone = requireText(input, 'contactPhone')
      const binding = ensureParentBinding(user.id, studentId)
      const schedule = findSchedule(scheduleId)

      if (schedule.classId !== binding.student.classId) {
        forbidden('只能为已绑定学生的课程提交请假')
      }
      if (schedule.status !== 'SCHEDULED' && schedule.status !== 'CHANGED') {
        conflict('当前课次状态不能提交请假')
      }
      if (
        data.leaveRequests.some(
          (item) =>
            item.studentId === studentId &&
            item.scheduleId === scheduleId &&
            item.status === 'PENDING',
        )
      ) {
        conflict('该课次已有待处理请假申请')
      }

      const timestamp = currentIso()
      const request: LeaveRequest = {
        id: nextId(data.leaveRequests, 9001),
        parentId: user.id,
        studentId,
        scheduleId,
        reason,
        contactPhone,
        status: 'PENDING',
        reviewedBy: null,
        reviewNote: '',
        reviewedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      data.leaveRequests.push(request)
      return clone(request)
    },

    respondToFeedback(user, feedbackId, input) {
      requireRole(user, ['PARENT'])
      const feedback = data.feedback.find((item) => item.id === feedbackId)
      if (!feedback) notFound('反馈不存在')
      ensureParentBinding(user.id, feedback.studentId)

      if (feedback.status !== 'PENDING_PARENT') {
        conflict('该反馈已经处理，不能重复操作')
      }
      const status = requireText(input, 'status')
      if (status !== 'CONFIRMED' && status !== 'DISPUTED') {
        invalid('status 只能是 CONFIRMED 或 DISPUTED')
      }
      const parentResponse = requireString(input, 'parentResponse').trim()
      if (status === 'DISPUTED' && !parentResponse) {
        invalid('提出异议时必须填写异议内容')
      }
      if (
        status === 'DISPUTED' &&
        data.workOrders.some((item) => item.feedbackId === feedback.id)
      ) {
        conflict('该反馈已经存在工单')
      }

      const timestamp = currentIso()
      feedback.status = status
      feedback.parentResponse = status === 'DISPUTED' ? parentResponse : ''
      feedback.respondedBy = user.id
      feedback.respondedAt = timestamp
      feedback.updatedAt = timestamp

      if (status === 'DISPUTED') {
        data.workOrders.push({
          id: nextId(data.workOrders, 6001),
          feedbackId: feedback.id,
          campusId: feedback.campusId,
          issue: parentResponse,
          status: 'OPEN',
          handlerId: null,
          result: '',
          createdAt: timestamp,
          updatedAt: timestamp,
          closedAt: null,
        })
      }
      return clone(feedback)
    },

    getStudentOverview(user) {
      return studentOverview(user)
    },

    submitStudentWork(user, input) {
      requireRole(user, ['STUDENT'])
      const student = findStudent(user.id)
      const assignmentId = requirePositiveInteger(input, 'assignmentId')
      const content = requireString(input, 'content').trim()
      const attachments = requireFiles(input, 'attachments')
      const assignment = data.assignments.find((item) => item.id === assignmentId)

      if (!assignment) notFound('作业不存在')
      if (assignment.classId !== student.classId) {
        forbidden('学生只能提交自己班级的作业')
      }
      if (!content && attachments.length === 0) {
        invalid('作业正文和附件不能同时为空')
      }

      const previous = data.submissions
        .filter(
          (item) =>
            item.assignmentId === assignmentId && item.studentId === user.id,
        )
        .sort((left, right) => right.attempt - left.attempt)[0]
      if (previous && previous.status !== 'REVISION_REQUIRED') {
        conflict('当前作业已提交，不能重复提交')
      }
      if (!assignment.allowLate && now() > Date.parse(assignment.dueAt)) {
        conflict('作业已截止，不能继续提交')
      }

      const timestamp = currentIso()
      const submission: Submission = {
        id: nextId(data.submissions, 4001),
        assignmentId,
        studentId: user.id,
        attempt: (previous?.attempt ?? 0) + 1,
        content,
        attachments,
        status: 'SUBMITTED',
        submittedAt: timestamp,
        score: null,
        teacherComment: '',
        gradedBy: null,
        gradedAt: null,
        updatedAt: timestamp,
      }
      data.submissions.push(submission)
      return clone(submission)
    },

    getTeacherOverview(user) {
      return teacherOverview(user)
    },

    saveAttendance(user, input) {
      const scheduleId = requirePositiveInteger(input, 'scheduleId')
      const schedule = ensureTeachingSchedule(user, scheduleId)
      if (schedule.status === 'CANCELLED') {
        conflict('已取消课次不能记录签到')
      }
      const records = input.records
      if (!Array.isArray(records) || records.length === 0) {
        invalid('records 必须是非空数组')
      }

      const studentIds = new Set<number>()
      const normalized = (records as unknown[]).map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          invalid(`records[${index}] 必须是对象`)
        }
        const candidate = item as BusinessInput
        const studentId = requirePositiveInteger(candidate, 'studentId')
        const status = requireText(candidate, 'status')
        const note = requireString(candidate, 'note').trim()

        if (studentIds.has(studentId)) invalid('records 中不能重复同一学生')
        studentIds.add(studentId)
        const student = findStudent(studentId)
        if (student.classId !== schedule.classId) {
          forbidden('只能记录当前课次班级学生的签到')
        }
        if (!ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
          invalid('签到状态不合法')
        }
        if (
          data.attendance.some(
            (record) =>
              record.scheduleId === scheduleId && record.studentId === studentId,
          )
        ) {
          conflict('该学生在当前课次已经签到')
        }
        return { studentId, status: status as AttendanceStatus, note }
      })

      const timestamp = currentIso()
      const firstId = nextId(data.attendance, 10_001)
      const created = normalized.map<AttendanceRecord>((item, index) => ({
        id: firstId + index,
        scheduleId,
        studentId: item.studentId,
        status: item.status,
        note: item.note,
        recordedBy: user.id,
        recordedAt: timestamp,
      }))
      data.attendance.push(...created)
      return clone(created)
    },

    publishAssignment(user, input) {
      requireRole(user, ['TEACHER', 'HOMEROOM_TEACHER'])
      const classId = requirePositiveInteger(input, 'classId')
      const courseId = requirePositiveInteger(input, 'courseId')
      const scheduleId = optionalPositiveInteger(input, 'scheduleId')
      const title = requireText(input, 'title')
      const description = requireText(input, 'description')
      const attachments = requireFiles(input, 'attachments')
      const dueAt = requireIsoTimestamp(input, 'dueAt')
      const allowLate = requireBoolean(input, 'allowLate')
      const classRecord = findClass(classId)
      const course = data.courses.find((item) => item.id === courseId)
      if (!course) notFound('课程不存在')
      if (course.campusId !== classRecord.campusId) {
        invalid('课程和班级必须属于同一校区')
      }

      const teachingSchedule = scheduleId
        ? ensureTeachingSchedule(user, scheduleId)
        : data.schedules.find(
            (item) =>
              item.teacherId === user.id &&
              item.classId === classId &&
              item.courseId === courseId,
          )
      if (!teachingSchedule) forbidden('只能为本人授课的班级和课程发布作业')
      if (
        teachingSchedule.classId !== classId ||
        teachingSchedule.courseId !== courseId
      ) {
        invalid('课次、班级和课程不一致')
      }
      if (teachingSchedule.status === 'CANCELLED') {
        conflict('已取消课次不能发布作业')
      }
      if (Date.parse(dueAt) <= now()) invalid('作业截止时间必须晚于当前时间')

      const timestamp = currentIso()
      const assignment: Assignment = {
        id: nextId(data.assignments, 3001),
        campusId: classRecord.campusId,
        classId,
        courseId,
        scheduleId: teachingSchedule.id,
        teacherId: user.id,
        title,
        description,
        attachments,
        dueAt,
        allowLate,
        publishedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      data.assignments.push(assignment)
      return clone(assignment)
    },

    gradeSubmission(user, submissionId, input) {
      requireRole(user, ['TEACHER', 'HOMEROOM_TEACHER'])
      const submission = data.submissions.find((item) => item.id === submissionId)
      if (!submission) notFound('提交记录不存在')
      const assignment = data.assignments.find(
        (item) => item.id === submission.assignmentId,
      )
      if (!assignment) notFound('关联作业不存在')
      if (assignment.teacherId !== user.id) {
        forbidden('只能批改本人发布的作业')
      }
      if (submission.status !== 'SUBMITTED') {
        conflict('该提交已经批改，不能重复处理')
      }

      const score = requireNumber(input, 'score')
      if (score < 0 || score > 100) invalid('score 必须在 0 到 100 之间')
      const teacherComment = requireString(input, 'teacherComment').trim()
      const correctionRequired = requireBoolean(input, 'correctionRequired')
      const timestamp = currentIso()

      submission.score = score
      submission.teacherComment = teacherComment
      submission.status = correctionRequired ? 'REVISION_REQUIRED' : 'GRADED'
      submission.gradedBy = user.id
      submission.gradedAt = timestamp
      submission.updatedAt = timestamp
      return clone(submission)
    },

    sendFeedback(user, input) {
      const scheduleId = requirePositiveInteger(input, 'scheduleId')
      const schedule = ensureTeachingSchedule(user, scheduleId)
      if (schedule.status === 'CANCELLED') {
        conflict('已取消课次不能发送反馈')
      }
      const studentId = requirePositiveInteger(input, 'studentId')
      const student = findStudent(studentId)
      if (student.classId !== schedule.classId) {
        forbidden('只能为当前课次班级的学生发送反馈')
      }
      if (
        data.feedback.some(
          (item) => item.scheduleId === scheduleId && item.studentId === studentId,
        )
      ) {
        conflict('该学生在当前课次已经存在反馈')
      }

      const timestamp = currentIso()
      const feedback: StudentFeedback = {
        id: nextId(data.feedback, 5001),
        campusId: schedule.campusId,
        scheduleId,
        studentId,
        teacherId: user.id,
        performance: requireText(input, 'performance'),
        strengths: requireText(input, 'strengths'),
        improvements: requireText(input, 'improvements'),
        suggestion: requireText(input, 'suggestion'),
        status: 'PENDING_PARENT',
        parentResponse: '',
        respondedBy: null,
        respondedAt: null,
        sentAt: timestamp,
        updatedAt: timestamp,
      }
      data.feedback.push(feedback)
      return clone(feedback)
    },

    requestScheduleChange(user, input) {
      const scheduleId = requirePositiveInteger(input, 'scheduleId')
      const schedule = ensureTeachingSchedule(user, scheduleId)
      if (schedule.status !== 'SCHEDULED' && schedule.status !== 'CHANGED') {
        conflict('当前课次状态不能申请调课')
      }
      if (
        data.scheduleChanges.some(
          (item) =>
            item.scheduleId === scheduleId &&
            !['REJECTED', 'COMPLETED'].includes(item.status),
        )
      ) {
        conflict('当前课次已有未结束的调课申请')
      }
      const proposedDate = requireDate(input, 'proposedDate')
      const proposedStartTime = requireTime(input, 'proposedStartTime')
      const proposedEndTime = requireTime(input, 'proposedEndTime')
      if (timeInSeconds(proposedEndTime) <= timeInSeconds(proposedStartTime)) {
        invalid('建议结束时间必须晚于开始时间')
      }

      const timestamp = currentIso()
      const change: ScheduleChange = {
        id: nextId(data.scheduleChanges, 7001),
        campusId: schedule.campusId,
        scheduleId,
        requestedBy: user.id,
        reason: requireText(input, 'reason'),
        originalTeacherId: schedule.teacherId,
        originalDate: schedule.lessonDate,
        originalStartTime: schedule.startTime,
        originalEndTime: schedule.endTime,
        proposedDate,
        proposedStartTime,
        proposedEndTime,
        status: 'PENDING',
        decisionNote: '',
        reviewedBy: null,
        reviewedAt: null,
        substituteTeacherId: null,
        substituteNote: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      data.scheduleChanges.push(change)
      return clone(change)
    },

    getAdminOverview(user) {
      return adminOverview(user)
    },

    reviewScheduleChange(user, changeId, input) {
      ensureAdmin(user)
      const change = data.scheduleChanges.find((item) => item.id === changeId)
      if (!change) notFound('调课申请不存在')
      ensureAdminCampus(user, change.campusId)
      if (change.status !== 'PENDING') {
        conflict('该调课申请已经审批')
      }

      const decision = requireText(input, 'decision')
      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        invalid('decision 只能是 APPROVED 或 REJECTED')
      }
      const decisionNote = requireString(input, 'decisionNote').trim()
      if (decision === 'REJECTED' && !decisionNote) {
        invalid('拒绝调课时必须填写原因')
      }

      const timestamp = currentIso()
      change.status = decision
      change.decisionNote = decisionNote
      change.reviewedBy = user.id
      change.reviewedAt = timestamp
      change.updatedAt = timestamp
      return clone(change)
    },

    assignSubstitute(user, changeId, input) {
      ensureAdmin(user)
      const change = data.scheduleChanges.find((item) => item.id === changeId)
      if (!change) notFound('调课申请不存在')
      ensureAdminCampus(user, change.campusId)
      if (change.status !== 'APPROVED') {
        conflict('只有已通过的申请可以安排代课')
      }

      const substituteTeacherId = requirePositiveInteger(
        input,
        'substituteTeacherId',
      )
      const substitute = data.users.find((item) => item.id === substituteTeacherId)
      if (
        !substitute ||
        !substitute.active ||
        (substitute.role !== 'TEACHER' &&
          substitute.role !== 'HOMEROOM_TEACHER')
      ) {
        notFound('代课教师不存在')
      }
      if (substitute.campusId !== change.campusId) {
        invalid('代课教师必须与调课申请属于同一校区')
      }
      if (substitute.id === change.originalTeacherId) {
        invalid('代课教师不能是原教师')
      }
      if (
        data.schedules.some(
          (item) =>
            item.id !== change.scheduleId &&
            item.teacherId === substitute.id &&
            item.lessonDate === change.proposedDate &&
            item.status !== 'CANCELLED' &&
            overlaps(
              item.startTime,
              item.endTime,
              change.proposedStartTime,
              change.proposedEndTime,
            ),
        )
      ) {
        conflict('代课教师在建议时间已有课程')
      }

      const schedule = findSchedule(change.scheduleId)
      const originalTeacher = data.users.find(
        (item) => item.id === change.originalTeacherId,
      )
      if (!originalTeacher) notFound('原教师不存在')
      const substituteNote = requireString(input, 'substituteNote').trim()
      const timestamp = currentIso()
      change.status = 'SUBSTITUTE_ASSIGNED'
      change.substituteTeacherId = substitute.id
      change.substituteNote = substituteNote
      change.updatedAt = timestamp
      schedule.teacherId = substitute.id
      schedule.lessonDate = change.proposedDate
      schedule.startTime = change.proposedStartTime
      schedule.endTime = change.proposedEndTime
      schedule.status = 'CHANGED'

      const affectedBindings = data.parentBindings.filter(
        (binding) => binding.student.classId === schedule.classId,
      )
      for (const binding of affectedBindings) {
        const notification = {
          id: nextId(data.notifications, 8001),
          userId: binding.parentId,
          studentId: binding.student.id,
          type: 'SCHEDULE_CHANGE' as const,
          title: '调课通知',
          content: `${originalTeacher.displayName}的课程已安排${substitute.displayName}代课。`,
          relatedType: 'ScheduleChange',
          relatedId: change.id,
          readAt: null,
          createdAt: timestamp,
        }
        data.notifications.push(notification)
        data.scheduleChangeNotices.push({
          notification,
          originalDate: change.originalDate,
          originalStartTime: change.originalStartTime,
          originalEndTime: change.originalEndTime,
          newDate: change.proposedDate,
          newStartTime: change.proposedStartTime,
          newEndTime: change.proposedEndTime,
          originalTeacherName: originalTeacher.displayName,
          substituteTeacherName: substitute.displayName,
        })
      }
      return clone(change)
    },

    updateWorkOrder(user, workOrderId, input) {
      ensureAdmin(user)
      const workOrder = data.workOrders.find((item) => item.id === workOrderId)
      if (!workOrder) notFound('反馈工单不存在')
      ensureAdminCampus(user, workOrder.campusId)
      if (workOrder.status === 'CLOSED') conflict('该工单已经关闭')

      const action = requireText(input, 'action')
      const timestamp = currentIso()
      if (action === 'START') {
        if (workOrder.status !== 'OPEN') conflict('该工单已经开始处理')
        workOrder.status = 'PROCESSING'
        workOrder.handlerId = user.id
        workOrder.updatedAt = timestamp
        return clone(workOrder)
      }
      if (action === 'CLOSE') {
        if (workOrder.status !== 'PROCESSING') {
          conflict('请先开始处理工单')
        }
        const result = requireText(input, 'result')
        workOrder.status = 'CLOSED'
        workOrder.handlerId = user.id
        workOrder.result = result
        workOrder.updatedAt = timestamp
        workOrder.closedAt = timestamp
        return clone(workOrder)
      }
      invalid('action 只能是 START 或 CLOSE')
    },

    reset() {
      data = initialData()
    },
  }
}
