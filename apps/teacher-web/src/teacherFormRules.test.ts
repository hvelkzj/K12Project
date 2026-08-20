import assert from 'node:assert/strict'
import test from 'node:test'
import type { ScheduleSummary } from '@k12/shared'

import {
  assignmentInput,
  feedbackInput,
  gradeInput,
  scheduleChangeInput,
} from './teacherFormRules'

const schedule: ScheduleSummary = {
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
}

test('作业请求包含课次、班级、课程和带时区截止时间', () => {
  assert.deepEqual(
    assignmentInput(schedule, {
      title: ' 数学练习 ',
      description: ' 完成第 1 页 ',
      dueAt: '2026-08-21T20:00',
      allowLate: false,
    }),
    {
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      title: '数学练习',
      description: '完成第 1 页',
      attachments: [],
      dueAt: '2026-08-21T20:00:00+08:00',
      allowLate: false,
    },
  )
  assert.throws(
    () => assignmentInput(schedule, { title: '', description: '内容', dueAt: '2026-08-21T20:00', allowLate: false }),
    /标题和内容不能为空/,
  )
  assert.throws(
    () => assignmentInput(schedule, { title: '标题', description: '内容', dueAt: '', allowLate: false }),
    /有效的作业截止时间/,
  )
})

test('批改分数限制为 0 到 100 并保留订正状态', () => {
  assert.deepEqual(
    gradeInput({ score: 0, teacherComment: ' 需要订正 ', correctionRequired: true }),
    { score: 0, teacherComment: '需要订正', correctionRequired: true },
  )
  assert.equal(gradeInput({ score: 100, teacherComment: '', correctionRequired: false }).score, 100)
  assert.throws(() => gradeInput({ score: -1, teacherComment: '', correctionRequired: false }), /0 到 100/)
  assert.throws(() => gradeInput({ score: 101, teacherComment: '', correctionRequired: false }), /0 到 100/)
})

test('课后反馈要求学生和四个文本字段', () => {
  assert.equal(
    feedbackInput(1001, {
      studentId: 101,
      performance: '认真',
      strengths: '计算准确',
      improvements: '审题',
      suggestion: '复习',
    }).studentId,
    101,
  )
  assert.throws(
    () => feedbackInput(1001, { studentId: 0, performance: '认真', strengths: '准确', improvements: '审题', suggestion: '复习' }),
    /选择反馈学生/,
  )
  assert.throws(
    () => feedbackInput(1001, { studentId: 101, performance: '', strengths: '准确', improvements: '审题', suggestion: '复习' }),
    /反馈字段不能为空/,
  )
})

test('调课请求校验日期、原因和开始结束时间', () => {
  assert.deepEqual(
    scheduleChangeInput(1001, {
      proposedDate: '2026-08-21',
      proposedStartTime: '10:00',
      proposedEndTime: '11:30',
      reason: ' 教研活动 ',
    }),
    {
      scheduleId: 1001,
      proposedDate: '2026-08-21',
      proposedStartTime: '10:00:00',
      proposedEndTime: '11:30:00',
      reason: '教研活动',
    },
  )
  assert.throws(
    () => scheduleChangeInput(1001, { proposedDate: '2026-08-21', proposedStartTime: '11:30', proposedEndTime: '10:00', reason: '活动' }),
    /开始时间必须早于结束时间/,
  )
  assert.throws(
    () => scheduleChangeInput(1001, { proposedDate: '', proposedStartTime: '10:00', proposedEndTime: '11:30', reason: '活动' }),
    /有效的调课日期/,
  )
  assert.throws(
    () => scheduleChangeInput(1001, { proposedDate: '2026-08-21', proposedStartTime: '10:00', proposedEndTime: '11:30', reason: '' }),
    /调课原因不能为空/,
  )
})
