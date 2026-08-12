import type {
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChangeNotice,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
} from '@k12/shared'
import { MOCK_ACCOUNTS, MOCK_ACCOUNT_PASSWORD } from '@k12/shared/mock-accounts'

export const mockParentCredentials = {
  username: 'parent_201',
  password: MOCK_ACCOUNT_PASSWORD,
} as const

const parentAccount = MOCK_ACCOUNTS.find(
  (account) => account.username === mockParentCredentials.username,
)

if (!parentAccount) {
  throw new Error('缺少家长测试账号 parent_201')
}

export const parentUser = parentAccount.user
export const parentProfile = {
  phone: '13800000001',
} as const

export const students: StudentSummary[] = [
  { id: 101, displayName: '林晓雨', classId: 1, className: '三年级 1 班', campusId: 1, campusName: '滨江校区' },
  { id: 102, displayName: '林晓晨', classId: 2, className: '一年级 2 班', campusId: 1, campusName: '滨江校区' },
  { id: 999, displayName: '未绑定学生', classId: 99, className: '五年级 1 班', campusId: 2, campusName: '未来校区' },
]

export const parentStudentBindings: ParentStudentBinding[] = [
  {
    parentId: parentUser.id,
    student: students[0]!,
    relationship: '母亲',
    createdAt: '2026-07-20T09:00:00+08:00',
  },
  {
    parentId: parentUser.id,
    student: students[1]!,
    relationship: '母亲',
    createdAt: '2026-07-20T09:05:00+08:00',
  },
]

export type ParentSchedule = ScheduleSummary & {
  studentId: number
  courseName: string
  teacherName: string
}

export const schedules: ParentSchedule[] = [
  {
    id: 1,
    campusId: 1,
    classId: 1,
    courseId: 1,
    teacherId: 301,
    studentId: 101,
    lessonDate: '2026-08-01',
    startTime: '09:00:00',
    endTime: '10:30:00',
    room: 'A203',
    status: 'SCHEDULED',
    courseName: '数学提高',
    teacherName: '李老师',
  },
  {
    id: 2,
    campusId: 1,
    classId: 1,
    courseId: 2,
    teacherId: 302,
    studentId: 101,
    lessonDate: '2026-08-02',
    startTime: '14:00:00',
    endTime: '15:30:00',
    room: 'B102',
    status: 'SCHEDULED',
    courseName: '英语阅读',
    teacherName: '周老师',
  },
  {
    id: 3,
    campusId: 1,
    classId: 2,
    courseId: 3,
    teacherId: 301,
    studentId: 102,
    lessonDate: '2026-08-01',
    startTime: '10:40:00',
    endTime: '12:10:00',
    room: 'A105',
    status: 'SCHEDULED',
    courseName: '拼音练习',
    teacherName: '李老师',
  },
]

export type ParentNotice = Notification | ScheduleChangeNotice

export const notices: ParentNotice[] = [
  {
    notification: {
      id: 1,
      userId: parentUser.id,
      studentId: 101,
      type: 'SCHEDULE_CHANGE',
      title: '数学提高调课通知',
      content: '李老师的数学提高课已完成调课审批。',
      relatedType: 'ScheduleChange',
      relatedId: 1,
      createdAt: '2026-07-31T18:30:00+08:00',
      readAt: null,
    },
    originalDate: '2026-08-01',
    originalStartTime: '09:00:00',
    originalEndTime: '10:30:00',
    newDate: '2026-08-01',
    newStartTime: '16:00:00',
    newEndTime: '17:30:00',
    originalTeacherName: '李老师',
    substituteTeacherName: '周老师',
  },
  {
    id: 2,
    userId: parentUser.id,
    studentId: 102,
    type: 'GENERAL',
    title: '上课提醒',
    content: '请提前 10 分钟到达教室。',
    relatedType: 'Schedule',
    relatedId: 3,
    createdAt: '2026-07-31T19:10:00+08:00',
    readAt: '2026-07-31T19:15:00+08:00',
  },
]

export type ParentFeedback = StudentFeedback & {
  courseName: string
  teacherName: string
}

export const feedbackList: ParentFeedback[] = [
  {
    id: 1,
    campusId: 1,
    scheduleId: 2,
    studentId: 101,
    teacherId: 302,
    courseName: '英语阅读',
    teacherName: '周老师',
    performance: '本周整体表现积极。',
    strengths: '课堂跟读积极，能主动回答问题。',
    improvements: '长句朗读还需要更稳定。',
    suggestion: '每天完成 10 分钟朗读打卡。',
    status: 'PENDING_PARENT',
    parentResponse: '',
    respondedBy: null,
    respondedAt: null,
    sentAt: '2026-08-02T16:00:00+08:00',
    updatedAt: '2026-08-02T16:00:00+08:00',
  },
]

export const initialLeaveRequests: LeaveRequest[] = []
