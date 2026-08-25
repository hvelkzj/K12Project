import assert from 'node:assert/strict'
import test from 'node:test'

import {
  businessDateKey,
  chooseSubstituteTeacherId,
  countSchedulesForBusinessDate,
} from './adminViewHelpers'
import type { Schedule } from './types'

const schedules: Schedule[] = [
  {
    id: 1001,
    campusId: 1,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    lessonDate: '2026-08-18',
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
    lessonDate: '2026-08-19',
    startTime: '14:00:00',
    endTime: '15:30:00',
    room: 'B-205',
    status: 'SCHEDULED',
  },
]

test('业务日期固定按 Asia/Shanghai 计算', () => {
  assert.equal(
    businessDateKey(new Date('2026-08-17T16:30:00.000Z')),
    '2026-08-18',
  )
})

test('今日排课只统计业务当天的数据', () => {
  assert.equal(
    countSchedulesForBusinessDate(
      schedules,
      new Date('2026-08-18T04:00:00.000Z'),
    ),
    1,
  )
})

test('代课申请变化后选择首个合法教师', () => {
  const candidates = [{ id: 302 }, { id: 303 }]

  assert.equal(chooseSubstituteTeacherId(null, candidates), 302)
  assert.equal(chooseSubstituteTeacherId(303, candidates), 303)
  assert.equal(chooseSubstituteTeacherId(401, candidates), 302)
  assert.equal(chooseSubstituteTeacherId(302, []), null)
})
