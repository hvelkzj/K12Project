import type {
  CourseSummary,
  LeaveRequest,
  Notification,
  ParentStudentBinding,
  ScheduleChangeNotice,
  ScheduleSummary,
  StudentFeedback,
  StudentSummary,
  UserSummary,
} from '@k12/shared'
import type { ParentOverview } from './parentBusinessClient'

export const parentUser: UserSummary = {
  id: 201,
  displayName: '林女士',
  role: 'PARENT',
  campusId: 1,
  campusName: '滨江校区',
}

export const studentOne: StudentSummary = {
  id: 101,
  displayName: '林晓雨',
  classId: 101,
  className: '三年级 1 班',
  campusId: 1,
  campusName: '滨江校区',
}

export const studentTwo: StudentSummary = {
  id: 102,
  displayName: '林晓晨',
  classId: 102,
  className: '一年级 2 班',
  campusId: 1,
  campusName: '滨江校区',
}

export const parentBindings: ParentStudentBinding[] = [
  {
    parentId: parentUser.id,
    student: studentOne,
    relationship: '母亲',
    createdAt: '2026-08-01T09:00:00+08:00',
  },
  {
    parentId: parentUser.id,
    student: studentTwo,
    relationship: '母亲',
    createdAt: '2026-08-01T09:00:00+08:00',
  },
]

export const mathCourse: CourseSummary = {
  id: 11,
  campusId: 1,
  name: '数学提高',
  subject: '数学',
}

export const readingCourse: CourseSummary = {
  id: 12,
  campusId: 1,
  name: '英语阅读',
  subject: '英语',
}

export const teacherLi: UserSummary = {
  id: 301,
  displayName: '李老师',
  role: 'TEACHER',
  campusId: 1,
  campusName: '滨江校区',
}

export const teacherZhou: UserSummary = {
  id: 302,
  displayName: '周老师',
  role: 'HOMEROOM_TEACHER',
  campusId: 1,
  campusName: '滨江校区',
}

export const scheduleOne: ScheduleSummary = {
  id: 1001,
  campusId: 1,
  classId: studentOne.classId,
  courseId: mathCourse.id,
  teacherId: teacherLi.id,
  lessonDate: '2026-08-19',
  startTime: '09:00:00',
  endTime: '10:30:00',
  room: 'A203',
  status: 'SCHEDULED',
}

export const scheduleTwo: ScheduleSummary = {
  id: 1002,
  campusId: 1,
  classId: studentTwo.classId,
  courseId: readingCourse.id,
  teacherId: teacherZhou.id,
  lessonDate: '2026-08-20',
  startTime: '14:00:00',
  endTime: '15:30:00',
  room: 'B102',
  status: 'SCHEDULED',
}

export const leaveRequest: LeaveRequest = {
  id: 9001,
  parentId: parentUser.id,
  studentId: studentOne.id,
  scheduleId: scheduleOne.id,
  reason: '身体不适',
  contactPhone: '13800000001',
  status: 'PENDING',
  reviewedBy: null,
  reviewNote: '',
  reviewedAt: null,
  createdAt: '2026-08-18T10:00:00+08:00',
  updatedAt: '2026-08-18T10:00:00+08:00',
}

export const generalNotice: Notification = {
  id: 8001,
  userId: parentUser.id,
  studentId: studentOne.id,
  type: 'GENERAL',
  title: '上课提醒',
  content: '请提前 10 分钟到达教室。',
  relatedType: 'Schedule',
  relatedId: scheduleOne.id,
  readAt: null,
  createdAt: '2026-08-18T09:00:00+08:00',
}

export const scheduleChangeNotice: ScheduleChangeNotice = {
  notification: {
    id: 8002,
    userId: parentUser.id,
    studentId: studentOne.id,
    type: 'SCHEDULE_CHANGE',
    title: '数学提高调课通知',
    content: '数学提高课已完成调课。',
    relatedType: 'ScheduleChange',
    relatedId: 7001,
    readAt: null,
    createdAt: '2026-08-18T09:30:00+08:00',
  },
  originalDate: '2026-08-19',
  originalStartTime: '09:00:00',
  originalEndTime: '10:30:00',
  newDate: '2026-08-21',
  newStartTime: '16:00:00',
  newEndTime: '17:30:00',
  originalTeacherName: '李老师',
  substituteTeacherName: '周老师',
}

export const pendingFeedback: StudentFeedback = {
  id: 5001,
  campusId: 1,
  scheduleId: scheduleOne.id,
  studentId: studentOne.id,
  teacherId: teacherLi.id,
  performance: '朗读认真。',
  strengths: '发音准确。',
  improvements: '语速需要更稳定。',
  suggestion: '每天朗读十分钟。',
  status: 'PENDING_PARENT',
  parentResponse: '',
  respondedBy: null,
  respondedAt: null,
  sentAt: '2026-08-18T16:00:00+08:00',
  updatedAt: '2026-08-18T16:00:00+08:00',
}

export const confirmedFeedback: StudentFeedback = {
  ...pendingFeedback,
  status: 'CONFIRMED',
  respondedBy: parentUser.id,
  respondedAt: '2026-08-18T17:00:00+08:00',
  updatedAt: '2026-08-18T17:00:00+08:00',
}

export const disputedFeedback: StudentFeedback = {
  ...pendingFeedback,
  status: 'DISPUTED',
  parentResponse: '课堂记录与实际情况不一致。',
  respondedBy: parentUser.id,
  respondedAt: '2026-08-18T17:00:00+08:00',
  updatedAt: '2026-08-18T17:00:00+08:00',
}

export const overviewOne: ParentOverview = {
  student: studentOne,
  schedules: [scheduleOne],
  courses: [mathCourse],
  teachers: [teacherLi, teacherZhou],
  leaveRequests: [],
  notifications: [generalNotice],
  scheduleChangeNotices: [scheduleChangeNotice],
  feedback: [pendingFeedback],
}

export const overviewTwo: ParentOverview = {
  student: studentTwo,
  schedules: [scheduleTwo],
  courses: [readingCourse],
  teachers: [teacherZhou],
  leaveRequests: [],
  notifications: [],
  scheduleChangeNotices: [],
  feedback: [],
}

export const emptyOverview: ParentOverview = {
  student: studentOne,
  schedules: [],
  courses: [],
  teachers: [],
  leaveRequests: [],
  notifications: [],
  scheduleChangeNotices: [],
  feedback: [],
}
