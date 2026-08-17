import type {
  Assignment,
  AttendanceRecord,
  CampusSummary,
  ClassSummary,
  CourseSummary,
  Courseware,
  FeedbackWorkOrder,
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChange,
  ScheduleChangeNotice,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
  Submission,
  UserAccountSummary,
} from '@k12/shared'
import { MOCK_ACCOUNTS } from '@k12/shared/mock-accounts'

export interface ClassRecord extends ClassSummary {
  homeroomTeacherId: number
}

export interface BusinessSeed {
  campuses: CampusSummary[]
  classes: ClassRecord[]
  courses: CourseSummary[]
  users: UserAccountSummary[]
  students: StudentSummary[]
  parentBindings: ParentStudentBinding[]
  schedules: ScheduleSummary[]
  attendance: AttendanceRecord[]
  leaveRequests: LeaveRequest[]
  courseware: Courseware[]
  assignments: Assignment[]
  submissions: Submission[]
  feedback: StudentFeedback[]
  scheduleChanges: ScheduleChange[]
  notifications: Notification[]
  scheduleChangeNotices: ScheduleChangeNotice[]
  workOrders: FeedbackWorkOrder[]
}

const shanghaiOffsetMs = 8 * 60 * 60 * 1000
const dayMs = 24 * 60 * 60 * 1000

function shanghaiDate(timestamp: number): string {
  return new Date(timestamp + shanghaiOffsetMs).toISOString().slice(0, 10)
}

function dateAt(timestamp: number, dayOffset: number, time: string): string {
  return `${shanghaiDate(timestamp + dayOffset * dayMs)}T${time}+08:00`
}

function publicAccounts(): UserAccountSummary[] {
  return MOCK_ACCOUNTS.map((account) => ({
    ...account.user,
    username: account.username,
    active: account.active,
  }))
}

export function createBusinessSeed(timestamp: number): BusinessSeed {
  const tomorrow = shanghaiDate(timestamp + dayMs)
  const dayAfterTomorrow = shanghaiDate(timestamp + 2 * dayMs)
  const createdAt = dateAt(timestamp, -7, '09:00:00')
  const now = new Date(timestamp).toISOString()

  const campuses: CampusSummary[] = [
    { id: 1, name: '滨江校区' },
    { id: 2, name: '城北校区' },
  ]
  const classes: ClassRecord[] = [
    { id: 101, campusId: 1, name: '六年级 1 班', homeroomTeacherId: 302 },
    { id: 102, campusId: 1, name: '六年级 2 班', homeroomTeacherId: 303 },
    { id: 201, campusId: 2, name: '五年级 1 班', homeroomTeacherId: 402 },
  ]
  const courses: CourseSummary[] = [
    { id: 11, campusId: 1, name: '数学提高班', subject: '数学' },
    { id: 12, campusId: 1, name: '英语阅读班', subject: '英语' },
    { id: 13, campusId: 2, name: '科学探索班', subject: '科学' },
  ]
  const users: UserAccountSummary[] = [
    ...publicAccounts(),
    {
      id: 102,
      campusId: 1,
      campusName: '滨江校区',
      displayName: '林晓晨',
      username: 'student_102',
      role: 'STUDENT',
      active: true,
    },
    {
      id: 103,
      campusId: 2,
      campusName: '城北校区',
      displayName: '陈安然',
      username: 'student_103',
      role: 'STUDENT',
      active: true,
    },
    {
      id: 303,
      campusId: 1,
      campusName: '滨江校区',
      displayName: '王老师',
      username: 'teacher_303',
      role: 'TEACHER',
      active: true,
    },
    {
      id: 401,
      campusId: 2,
      campusName: '城北校区',
      displayName: '陈老师',
      username: 'teacher_401',
      role: 'TEACHER',
      active: true,
    },
    {
      id: 402,
      campusId: 2,
      campusName: '城北校区',
      displayName: '赵老师',
      username: 'teacher_402',
      role: 'HOMEROOM_TEACHER',
      active: true,
    },
  ]
  const students: StudentSummary[] = [
    {
      id: 101,
      displayName: '林晓雨',
      classId: 101,
      className: '六年级 1 班',
      campusId: 1,
      campusName: '滨江校区',
    },
    {
      id: 102,
      displayName: '林晓晨',
      classId: 102,
      className: '六年级 2 班',
      campusId: 1,
      campusName: '滨江校区',
    },
    {
      id: 103,
      displayName: '陈安然',
      classId: 201,
      className: '五年级 1 班',
      campusId: 2,
      campusName: '城北校区',
    },
  ]
  const parentBindings: ParentStudentBinding[] = [
    { parentId: 201, student: students[0]!, relationship: '母亲', createdAt },
    { parentId: 201, student: students[1]!, relationship: '母亲', createdAt },
  ]
  const schedules: ScheduleSummary[] = [
    {
      id: 1001,
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      lessonDate: tomorrow,
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
      status: 'SCHEDULED',
    },
    {
      id: 1002,
      campusId: 1,
      classId: 102,
      courseId: 12,
      teacherId: 303,
      lessonDate: tomorrow,
      startTime: '14:00:00',
      endTime: '15:30:00',
      room: 'B-205',
      status: 'SCHEDULED',
    },
    {
      id: 1003,
      campusId: 1,
      classId: 101,
      courseId: 12,
      teacherId: 302,
      lessonDate: dayAfterTomorrow,
      startTime: '14:00:00',
      endTime: '15:30:00',
      room: 'B-102',
      status: 'SCHEDULED',
    },
    {
      id: 1004,
      campusId: 1,
      classId: 102,
      courseId: 12,
      teacherId: 302,
      lessonDate: dayAfterTomorrow,
      startTime: '16:30:00',
      endTime: '18:00:00',
      room: 'B-203',
      status: 'SCHEDULED',
    },
    {
      id: 2001,
      campusId: 2,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      lessonDate: tomorrow,
      startTime: '10:00:00',
      endTime: '11:30:00',
      room: 'C-101',
      status: 'SCHEDULED',
    },
  ]
  const firstFile = {
    id: 9001,
    originalName: '分数练习.pdf',
    mimeType: 'application/pdf',
    byteSize: 640_000,
    createdAt,
  }
  const courseware: Courseware[] = [
    {
      id: 2001,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      title: '分数混合运算讲义',
      description: '复习运算顺序并完成课堂例题。',
      attachments: [firstFile],
      publishedAt: createdAt,
    },
  ]
  const assignments: Assignment[] = [
    {
      id: 3001,
      campusId: 1,
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      teacherId: 301,
      title: '分数单元练习',
      description: '完成练习册第 18—20 页。',
      attachments: [firstFile],
      dueAt: dateAt(timestamp, 3, '20:00:00'),
      allowLate: false,
      publishedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3002,
      campusId: 1,
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      teacherId: 301,
      title: '分数计算订正',
      description: '订正课堂练习中的错题。',
      attachments: [],
      dueAt: dateAt(timestamp, 2, '20:00:00'),
      allowLate: false,
      publishedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3003,
      campusId: 1,
      classId: 101,
      courseId: 12,
      scheduleId: 1003,
      teacherId: 302,
      title: '英语朗读订正',
      description: '根据评语重新整理朗读内容。',
      attachments: [],
      dueAt: dateAt(timestamp, 4, '20:00:00'),
      allowLate: true,
      publishedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
  ]
  const submissions: Submission[] = [
    {
      id: 4001,
      assignmentId: 3002,
      studentId: 101,
      attempt: 1,
      content: '第一次计算过程。',
      attachments: [],
      status: 'SUBMITTED',
      submittedAt: dateAt(timestamp, -1, '19:00:00'),
      teacherComment: '',
      updatedAt: dateAt(timestamp, -1, '19:00:00'),
    },
    {
      id: 4002,
      assignmentId: 3003,
      studentId: 101,
      attempt: 1,
      content: '第一次朗读文字稿。',
      attachments: [],
      status: 'REVISION_REQUIRED',
      submittedAt: dateAt(timestamp, -1, '19:30:00'),
      score: 70,
      teacherComment: '请补充完整句子后订正。',
      gradedBy: 302,
      gradedAt: now,
      updatedAt: now,
    },
  ]
  const feedback: StudentFeedback[] = [
    {
      id: 5001,
      campusId: 1,
      scheduleId: 1001,
      studentId: 101,
      teacherId: 301,
      performance: '课堂专注，能够主动回答问题。',
      strengths: '分数计算准确。',
      improvements: '应用题单位需要更仔细。',
      suggestion: '复习课堂错题。',
      status: 'PENDING_PARENT',
      parentResponse: '',
      sentAt: createdAt,
      updatedAt: createdAt,
    },
  ]
  const scheduleChanges: ScheduleChange[] = [
    {
      id: 7001,
      campusId: 1,
      scheduleId: 1001,
      requestedBy: 301,
      reason: '参加学校教研活动',
      originalTeacherId: 301,
      originalDate: tomorrow,
      originalStartTime: '09:00:00',
      originalEndTime: '10:30:00',
      proposedDate: dayAfterTomorrow,
      proposedStartTime: '16:00:00',
      proposedEndTime: '17:30:00',
      status: 'PENDING',
      decisionNote: '',
      substituteNote: '',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 7002,
      campusId: 2,
      scheduleId: 2001,
      requestedBy: 401,
      reason: '外出参加比赛带队',
      originalTeacherId: 401,
      originalDate: tomorrow,
      originalStartTime: '10:00:00',
      originalEndTime: '11:30:00',
      proposedDate: dayAfterTomorrow,
      proposedStartTime: '10:00:00',
      proposedEndTime: '11:30:00',
      status: 'PENDING',
      decisionNote: '',
      substituteNote: '',
      createdAt,
      updatedAt: createdAt,
    },
  ]
  const notifications: Notification[] = [
    {
      id: 8001,
      userId: 201,
      studentId: 102,
      type: 'GENERAL',
      title: '上课提醒',
      content: '请提前 10 分钟到达教室。',
      relatedType: 'Schedule',
      relatedId: 1002,
      readAt: null,
      createdAt,
    },
  ]

  return {
    campuses,
    classes,
    courses,
    users,
    students,
    parentBindings,
    schedules,
    attendance: [],
    leaveRequests: [],
    courseware,
    assignments,
    submissions,
    feedback,
    scheduleChanges,
    notifications,
    scheduleChangeNotices: [],
    workOrders: [],
  }
}
