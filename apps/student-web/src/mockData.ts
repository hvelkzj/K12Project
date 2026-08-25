import type {
  Assignment,
  AttendanceRecord,
  CourseSummary,
  Courseware,
  StudentSummary,
  Submission,
  UserSummary,
} from '@k12/shared'

import type { StudentOverview } from './studentBusinessClient'

// 运行时页面不再读取业务 Mock；本文件只作为测试夹具使用，
// 内容对齐 apps/api/src/businessSeed.ts 中林晓雨（student_101）的数据。
export const mockNow = '2026-08-07T10:00:00+08:00'

export const studentId = 101
export const studentClassId = 101

const student: StudentSummary = {
  id: 101,
  displayName: '林晓雨',
  classId: 101,
  className: '六年级 1 班',
  campusId: 1,
  campusName: '滨江校区',
}

const courses: CourseSummary[] = [
  { id: 11, campusId: 1, name: '数学提高班', subject: '数学' },
  { id: 12, campusId: 1, name: '英语阅读班', subject: '英语' },
]

const teachers: UserSummary[] = [
  { id: 301, displayName: '李老师', role: 'TEACHER', campusId: 1, campusName: '滨江校区' },
  { id: 302, displayName: '周老师', role: 'HOMEROOM_TEACHER', campusId: 1, campusName: '滨江校区' },
]

const courseware: Courseware[] = [
  {
    id: 2001,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    title: '分数混合运算讲义',
    description: '复习运算顺序并完成课堂例题。',
    attachments: [
      {
        id: 9001,
        originalName: '分数练习.pdf',
        mimeType: 'application/pdf',
        byteSize: 640_000,
        createdAt: '2026-08-06T09:00:00+08:00',
      },
    ],
    publishedAt: '2026-08-06T09:00:00+08:00',
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
    attachments: [],
    dueAt: '2026-08-20T20:00:00+08:00',
    allowLate: false,
    publishedAt: '2026-08-06T09:00:00+08:00',
    createdAt: '2026-08-06T09:00:00+08:00',
    updatedAt: '2026-08-06T09:00:00+08:00',
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
    dueAt: '2026-08-12T20:00:00+08:00',
    allowLate: false,
    publishedAt: '2026-08-06T09:00:00+08:00',
    createdAt: '2026-08-06T09:00:00+08:00',
    updatedAt: '2026-08-06T09:00:00+08:00',
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
    dueAt: '2026-08-22T20:00:00+08:00',
    allowLate: true,
    publishedAt: '2026-08-06T09:00:00+08:00',
    createdAt: '2026-08-06T09:00:00+08:00',
    updatedAt: '2026-08-06T09:00:00+08:00',
  },
  {
    id: 3004,
    campusId: 1,
    classId: 101,
    courseId: 12,
    scheduleId: 1003,
    teacherId: 302,
    title: '科学观察日记',
    description: '记录一周内植物叶片的变化。',
    attachments: [],
    dueAt: '2026-08-01T20:00:00+08:00',
    allowLate: false,
    publishedAt: '2026-07-24T16:00:00+08:00',
    createdAt: '2026-07-24T15:50:00+08:00',
    updatedAt: '2026-07-24T16:00:00+08:00',
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
    submittedAt: '2026-08-06T19:00:00+08:00',
    score: null,
    teacherComment: '',
    gradedBy: null,
    gradedAt: null,
    updatedAt: '2026-08-06T19:00:00+08:00',
  },
  {
    id: 4002,
    assignmentId: 3003,
    studentId: 101,
    attempt: 1,
    content: '第一次朗读文字稿。',
    attachments: [],
    status: 'REVISION_REQUIRED',
    submittedAt: '2026-08-06T19:30:00+08:00',
    score: 70,
    teacherComment: '请补充完整句子后订正。',
    gradedBy: 302,
    gradedAt: '2026-08-07T08:00:00+08:00',
    updatedAt: '2026-08-07T08:00:00+08:00',
  },
]

const attendance: AttendanceRecord[] = [
  {
    id: 10_001,
    scheduleId: 1001,
    studentId,
    status: 'PRESENT',
    note: '按时到课',
    recordedBy: 301,
    recordedAt: '2026-08-07T09:05:00+08:00',
  },
]

export function createStudentOverviewFixture(): StudentOverview {
  return structuredClone({
    student,
    courses,
    teachers,
    courseware,
    assignments,
    submissions,
    attendance,
  })
}
