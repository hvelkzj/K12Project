import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { CourseSummary } from '@k12/shared'

import {
  getCourseDisplayCode,
  getCourseDisplayIcon,
  getCourseDisplayName,
} from './coursePresentation'

const courses: CourseSummary[] = [
  { id: 11, campusId: 1, name: '数学提高班', subject: '数学' },
  { id: 12, campusId: 1, name: '英语阅读班', subject: '英语' },
  { id: 88, campusId: 1, name: '编程入门', subject: 'Coding' },
]

test('课程名称和代码由概览课程数据派生而不是固定 ID 映射', () => {
  assert.equal(getCourseDisplayName(courses, 12), '英语阅读班')
  assert.equal(getCourseDisplayCode(courses, 12), 'ENG')
  assert.equal(getCourseDisplayIcon(courses, 12), 'A')
  assert.equal(getCourseDisplayCode(courses, 88), 'CODING')
  assert.equal(getCourseDisplayIcon(courses, 88), 'C')
})

test('概览缺少课程时显示包含 ID 的明确兜底', () => {
  assert.equal(getCourseDisplayName(courses, 999), '课程 #999')
  assert.equal(getCourseDisplayCode(courses, 999), 'COURSE-999')
  assert.equal(getCourseDisplayIcon(courses, 999), '书')
})
