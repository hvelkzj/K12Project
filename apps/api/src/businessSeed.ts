import type {
  Assignment,
  AttendanceRecord,
  CampusSummary,
  ClassSummary,
  CourseSummary,
  Courseware,
  FeedbackWorkOrder,
  FileSummary,
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

export interface SeedFileAsset {
  summary: FileSummary
  content: Uint8Array
  uploadedBy?: number | null
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
  files: SeedFileAsset[]
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

function simplePdf(text: string): Uint8Array {
  const escaped = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
  const stream = `BT /F1 16 Tf 72 720 Td (${escaped}) Tj ET\n`
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`,
  ]
  let body = '%PDF-1.4\n'
  const offsets = objects.map((object) => {
    const offset = Buffer.byteLength(body)
    body += object
    return offset
  })
  const xrefOffset = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(body)
}

function seedFile(
  id: number,
  originalName: string,
  mimeType: string,
  content: Uint8Array,
  createdAt: string,
): SeedFileAsset {
  return {
    summary: {
      id,
      originalName,
      mimeType,
      byteSize: content.byteLength,
      createdAt,
    },
    content,
  }
}

export function createBusinessSeed(timestamp: number): BusinessSeed {
  const tomorrow = shanghaiDate(timestamp + dayMs)
  const dayAfterTomorrow = shanghaiDate(timestamp + 2 * dayMs)
  const lastWeek = shanghaiDate(timestamp - 7 * dayMs)
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
  const users: UserAccountSummary[] = publicAccounts()
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
    { parentId: 202, student: students[2]!, relationship: '父亲', createdAt },
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
    {
      id: 1101,
      campusId: 1,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      lessonDate: lastWeek,
      startTime: '09:00:00',
      endTime: '10:30:00',
      room: 'A-302',
      status: 'COMPLETED',
    },
    {
      id: 2101,
      campusId: 2,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      lessonDate: lastWeek,
      startTime: '10:00:00',
      endTime: '11:30:00',
      room: 'C-101',
      status: 'COMPLETED',
    },
  ]
  const fileAssets = [
    seedFile(
      9001,
      '分数练习.pdf',
      'application/pdf',
      simplePdf('K12 Math Practice - Fraction Exercises'),
      createdAt,
    ),
    seedFile(
      9002,
      '英语阅读方法.pdf',
      'application/pdf',
      simplePdf('K12 English Reading - Key Word Practice'),
      createdAt,
    ),
    seedFile(
      9003,
      '水循环观察表.png',
      'image/png',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
      createdAt,
    ),
    seedFile(
      9004,
      '林晓雨分数订正.pdf',
      'application/pdf',
      simplePdf('Student 101 - Fraction correction work'),
      dateAt(timestamp, -1, '19:00:00'),
    ),
    seedFile(
      9005,
      '陈安然实验预测.pdf',
      'application/pdf',
      simplePdf('Student 103 - Water cycle experiment prediction'),
      dateAt(timestamp, 0, '08:30:00'),
    ),
  ]
  const [firstAsset, secondAsset, thirdAsset, fourthAsset, fifthAsset] =
    fileAssets
  const firstFile = firstAsset!.summary
  const secondFile = secondAsset!.summary
  const thirdFile = thirdAsset!.summary
  const fourthFile = fourthAsset!.summary
  const fifthFile = fifthAsset!.summary
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
    {
      id: 2002,
      classId: 102,
      courseId: 12,
      teacherId: 303,
      title: '英语阅读方法讲义',
      description: '学习定位关键词并概括段落大意。',
      attachments: [secondFile],
      publishedAt: createdAt,
    },
    {
      id: 2003,
      classId: 201,
      courseId: 13,
      teacherId: 401,
      title: '水循环观察记录',
      description: '记录蒸发、凝结和降水三个阶段的实验现象。',
      attachments: [thirdFile],
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
    {
      id: 3004,
      campusId: 1,
      classId: 102,
      courseId: 12,
      scheduleId: 1002,
      teacherId: 303,
      title: '阅读理解要点整理',
      description: '阅读讲义并归纳三条定位关键信息的方法。',
      attachments: [secondFile],
      dueAt: dateAt(timestamp, 3, '20:00:00'),
      allowLate: true,
      publishedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3005,
      campusId: 2,
      classId: 201,
      courseId: 13,
      scheduleId: 2001,
      teacherId: 401,
      title: '水循环实验预习',
      description: '根据观察表写出实验预测和需要记录的现象。',
      attachments: [thirdFile],
      dueAt: dateAt(timestamp, 3, '19:00:00'),
      allowLate: false,
      publishedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3006,
      campusId: 2,
      classId: 201,
      courseId: 13,
      scheduleId: 2101,
      teacherId: 401,
      title: '科学观察周记',
      description: '整理上周实验观察结果并写出结论。',
      attachments: [],
      dueAt: dateAt(timestamp, -4, '19:00:00'),
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
      attachments: [fourthFile],
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
    {
      id: 4003,
      assignmentId: 3004,
      studentId: 102,
      attempt: 1,
      content: '我会先读问题，再圈出文章中的关键词，最后联系上下文作答。',
      attachments: [],
      status: 'GRADED',
      submittedAt: dateAt(timestamp, -1, '19:10:00'),
      score: 92,
      teacherComment: '归纳清楚，继续注意用完整句表达。',
      gradedBy: 303,
      gradedAt: now,
      updatedAt: now,
    },
    {
      id: 4004,
      assignmentId: 3005,
      studentId: 103,
      attempt: 1,
      content: '预测加热后水会蒸发，遇冷后形成小水滴。',
      attachments: [fifthFile],
      status: 'SUBMITTED',
      submittedAt: dateAt(timestamp, 0, '08:30:00'),
      score: null,
      teacherComment: '',
      gradedBy: null,
      gradedAt: null,
      updatedAt: dateAt(timestamp, 0, '08:30:00'),
    },
    {
      id: 4005,
      assignmentId: 3006,
      studentId: 103,
      attempt: 1,
      content: '实验中瓶壁出现水珠，说明水蒸气遇冷凝结。',
      attachments: [],
      status: 'GRADED',
      submittedAt: dateAt(timestamp, -5, '18:20:00'),
      score: 88,
      teacherComment: '现象记录准确，可以再说明变量条件。',
      gradedBy: 401,
      gradedAt: dateAt(timestamp, -4, '09:00:00'),
      updatedAt: dateAt(timestamp, -4, '09:00:00'),
    },
  ]
  const attendance: AttendanceRecord[] = [
    {
      id: 10_001,
      scheduleId: 1101,
      studentId: 101,
      status: 'PRESENT',
      note: '按时到课',
      recordedBy: 301,
      recordedAt: dateAt(timestamp, -7, '09:05:00'),
    },
    {
      id: 10_002,
      scheduleId: 2101,
      studentId: 103,
      status: 'LATE',
      note: '迟到 5 分钟，已与家长沟通',
      recordedBy: 401,
      recordedAt: dateAt(timestamp, -7, '10:05:00'),
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
    {
      id: 5002,
      campusId: 1,
      scheduleId: 1101,
      studentId: 101,
      teacherId: 301,
      performance: '能够独立完成课堂练习并主动讲解思路。',
      strengths: '计算步骤完整，表达清晰。',
      improvements: '检查答案时可以再耐心一些。',
      suggestion: '每天安排十分钟进行口算检查。',
      status: 'CONFIRMED',
      parentResponse: '已了解，会在家提醒孩子检查。',
      respondedBy: 201,
      respondedAt: dateAt(timestamp, -6, '20:00:00'),
      sentAt: dateAt(timestamp, -7, '11:00:00'),
      updatedAt: dateAt(timestamp, -6, '20:00:00'),
    },
    {
      id: 5003,
      campusId: 2,
      scheduleId: 2101,
      studentId: 103,
      teacherId: 401,
      performance: '实验记录认真，但小组讨论参与度不足。',
      strengths: '能够准确描述实验现象。',
      improvements: '需要更主动地表达自己的判断。',
      suggestion: '下次实验承担小组汇报任务。',
      status: 'DISPUTED',
      parentResponse: '孩子反馈当天身体不适，希望老师结合实际情况复核。',
      respondedBy: 202,
      respondedAt: dateAt(timestamp, -6, '20:30:00'),
      sentAt: dateAt(timestamp, -7, '12:00:00'),
      updatedAt: dateAt(timestamp, -6, '20:30:00'),
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
    {
      id: 8002,
      userId: 201,
      studentId: 101,
      type: 'FEEDBACK',
      title: '课后反馈已确认',
      content: '您已确认林晓雨的数学课堂反馈。',
      relatedType: 'StudentFeedback',
      relatedId: 5002,
      readAt: dateAt(timestamp, -6, '20:00:00'),
      createdAt: dateAt(timestamp, -7, '11:00:00'),
    },
    {
      id: 8003,
      userId: 202,
      studentId: 103,
      type: 'FEEDBACK',
      title: '反馈异议处理中',
      content: '学校已收到您对科学课反馈的补充说明。',
      relatedType: 'FeedbackWorkOrder',
      relatedId: 6001,
      readAt: null,
      createdAt: dateAt(timestamp, -6, '20:30:00'),
    },
  ]
  const workOrders: FeedbackWorkOrder[] = [
    {
      id: 6001,
      feedbackId: 5003,
      campusId: 2,
      issue: '孩子反馈当天身体不适，希望老师结合实际情况复核。',
      status: 'OPEN',
      handlerId: null,
      result: '',
      createdAt: dateAt(timestamp, -6, '20:30:00'),
      updatedAt: dateAt(timestamp, -6, '20:30:00'),
      closedAt: null,
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
    attendance,
    leaveRequests: [],
    courseware,
    assignments,
    submissions,
    feedback,
    scheduleChanges,
    notifications,
    scheduleChangeNotices: [],
    workOrders,
    files: fileAssets,
  }
}
