import assert from 'node:assert/strict'
import test from 'node:test'

import type { StudentOverview, Submission } from '@k12/shared'

import {
  assignmentRows,
  assignmentStatusLabel,
  attendanceStatusLabel,
  attendanceSummary,
  filterCourseware,
  latestSubmission,
  validateAttachment,
} from './mobilePresentation'

const overview: StudentOverview = {
  student: {
    id: 101,
    displayName: '林晓雨',
    classId: 101,
    className: '六年级 1 班',
    campusId: 1,
    campusName: '滨江校区',
  },
  courses: [],
  teachers: [],
  courseware: [
    {
      id: 2001,
      classId: 101,
      courseId: 11,
      teacherId: 301,
      title: '分数复习',
      description: '练习讲解',
      attachments: [],
      publishedAt: '2026-08-24T02:00:00.000Z',
    },
  ],
  assignments: [
    {
      id: 3001,
      campusId: 1,
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      teacherId: 301,
      title: '分数练习',
      description: '完成练习',
      attachments: [],
      dueAt: '2026-08-27T12:00:00.000Z',
      allowLate: false,
      publishedAt: '2026-08-24T02:00:00.000Z',
      createdAt: '2026-08-24T02:00:00.000Z',
      updatedAt: '2026-08-24T02:00:00.000Z',
    },
  ],
  submissions: [],
  attendance: [
    {
      id: 10001,
      scheduleId: 1001,
      studentId: 101,
      status: 'PRESENT',
      note: '',
      recordedBy: 301,
      recordedAt: '2026-08-24T02:00:00.000Z',
    },
    {
      id: 10002,
      scheduleId: 1002,
      studentId: 101,
      status: 'LATE',
      note: '迟到五分钟',
      recordedBy: 301,
      recordedAt: '2026-08-25T02:00:00.000Z',
    },
  ],
}

test('移动端从公共概览派生待提交作业', () => {
  const [row] = assignmentRows(overview)
  assert.equal(row?.status, 'NOT_SUBMITTED')
  assert.equal(assignmentStatusLabel(row?.status ?? 'SUBMITTED'), '待提交')
})

test('最新 attempt 决定作业状态且历史记录仍保留', () => {
  const submissions: Submission[] = [
    {
      id: 1,
      assignmentId: 3001,
      studentId: 101,
      attempt: 1,
      content: '首次提交',
      attachments: [],
      status: 'REVISION_REQUIRED',
      submittedAt: '2026-08-24T02:00:00.000Z',
      score: 70,
      teacherComment: '请订正',
      gradedBy: 301,
      gradedAt: '2026-08-24T03:00:00.000Z',
      updatedAt: '2026-08-24T03:00:00.000Z',
    },
    {
      id: 2,
      assignmentId: 3001,
      studentId: 101,
      attempt: 2,
      content: '订正提交',
      attachments: [],
      status: 'SUBMITTED',
      submittedAt: '2026-08-25T02:00:00.000Z',
      score: null,
      teacherComment: '',
      gradedBy: null,
      gradedAt: null,
      updatedAt: '2026-08-25T02:00:00.000Z',
    },
  ]
  assert.equal(latestSubmission(submissions, 3001)?.attempt, 2)
  assert.equal(assignmentRows({ ...overview, submissions })[0]?.status, 'SUBMITTED')
  assert.equal(submissions.length, 2)
})

test('课件搜索同时匹配标题和说明', () => {
  assert.equal(filterCourseware(overview.courseware, '分数').length, 1)
  assert.equal(filterCourseware(overview.courseware, '讲解').length, 1)
  assert.equal(filterCourseware(overview.courseware, '英语').length, 0)
})

test('考勤使用中文标签并统计公共状态', () => {
  assert.equal(attendanceStatusLabel('PRESENT'), '已出勤')
  assert.equal(attendanceStatusLabel('LATE'), '迟到')
  assert.deepEqual(attendanceSummary(overview.attendance), {
    PRESENT: 1,
    LATE: 1,
    ABSENT: 0,
    LEAVE: 0,
  })
})

test('附件限制格式、空文件和 10 MB 上限', () => {
  assert.equal(validateAttachment('作业.jpg', 'image/jpeg', 1024), null)
  assert.match(
    validateAttachment('程序.exe', 'application/octet-stream', 1024) ?? '',
    /仅支持/,
  )
  assert.match(validateAttachment('空.pdf', 'application/pdf', 0) ?? '', /不能为空/)
  assert.match(
    validateAttachment('超大.pdf', 'application/pdf', 10 * 1024 * 1024 + 1) ?? '',
    /10 MB/,
  )
})
