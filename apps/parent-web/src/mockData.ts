import type {
  ParentNotice,
  ParentUser,
  ScheduleItem,
  Student,
  StudentFeedback,
} from './types'

export const mockParentCredentials = {
  username: 'parent_b',
  password: 'Parent123!',
} as const

export const parentUser: ParentUser = {
  id: 1,
  displayName: '王女士',
  phone: '13800000001',
  boundStudentIds: [2, 3],
}

export const students: Student[] = [
  { id: 2, displayName: '王小明', classId: 1, className: '三年级 1 班', campusId: 1, campusName: '东校区' },
  { id: 3, displayName: '王小雨', classId: 2, className: '一年级 2 班', campusId: 1, campusName: '东校区' },
  { id: 999, displayName: '未绑定学生', classId: 99, className: '五年级 1 班', campusId: 2, campusName: '西校区' },
]

export const schedules: ScheduleItem[] = [
  {
    id: 1,
    studentId: 2,
    lessonDate: '2026-08-01',
    startTime: '09:00',
    endTime: '10:30',
    courseName: '数学提高',
    teacherName: '李老师',
    roomName: 'A203',
  },
  {
    id: 2,
    studentId: 2,
    lessonDate: '2026-08-02',
    startTime: '14:00',
    endTime: '15:30',
    courseName: '英语阅读',
    teacherName: '陈老师',
    roomName: 'B102',
  },
  {
    id: 3,
    studentId: 3,
    lessonDate: '2026-08-01',
    startTime: '10:40',
    endTime: '12:10',
    courseName: '拼音练习',
    teacherName: '赵老师',
    roomName: 'A105',
  },
]

export const notices: ParentNotice[] = [
  {
    id: 1,
    studentId: 2,
    type: 'SCHEDULE_CHANGE',
    title: '数学提高调课通知',
    content: '李老师的数学提高课已完成调课审批。',
    originalTime: '2026-08-01 09:00-10:30',
    newTime: '2026-08-01 16:00-17:30',
    substituteTeacherName: '周老师',
    createdAt: '2026-07-31 18:30',
    readAt: null,
  },
  {
    id: 2,
    studentId: 3,
    type: 'GENERAL',
    title: '上课提醒',
    content: '请提前 10 分钟到达教室。',
    createdAt: '2026-07-31 19:10',
    readAt: '2026-07-31T19:15:00+08:00',
  },
]

export const initialNoticeReadState = notices.map((notice) => ({
  id: notice.id,
  readAt: notice.readAt,
}))

export const feedbackList: StudentFeedback[] = [
  {
    id: 1,
    studentId: 2,
    courseName: '英语阅读',
    teacherName: '陈老师',
    strengths: '课堂跟读积极，能主动回答问题。',
    improvements: '长句朗读还需要更稳定。',
    suggestion: '每天完成 10 分钟朗读打卡。',
    status: 'PENDING_PARENT',
    parentResponse: '',
  },
]

export const initialFeedbackState = feedbackList.map((feedback) => ({
  id: feedback.id,
  status: feedback.status,
  parentResponse: feedback.parentResponse,
}))
