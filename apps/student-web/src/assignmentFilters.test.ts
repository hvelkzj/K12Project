import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Submission } from '@k12/shared'

import { listAssignmentRows } from './assignmentListService'
import {
  filterAssignmentRows,
  listCourseFilterOptions,
} from './assignmentFilters'
import { createStudentOverviewFixture, mockNow, studentId } from './mockData'
import type { StudentOverview } from './studentBusinessClient'

function withSubmission(
  overview: StudentOverview,
  item: Submission,
): StudentOverview {
  return { ...overview, submissions: [...overview.submissions, item] }
}

function gradedRows() {
  const overview = withSubmission(createStudentOverviewFixture(), {
    id: 4005,
    assignmentId: 3004,
    studentId,
    attempt: 1,
    content: '一周观察记录',
    attachments: [],
    status: 'GRADED',
    submittedAt: mockNow,
    score: 88,
    teacherComment: '记录完整。',
    gradedBy: 302,
    gradedAt: mockNow,
    updatedAt: mockNow,
  })

  return listAssignmentRows(overview)
}

test('全部筛选返回全部作业', () => {
  const rows = listAssignmentRows(createStudentOverviewFixture())

  assert.equal(
    filterAssignmentRows(rows, { status: 'ALL', courseId: 'ALL' }).length,
    4,
  )
})

test('五种状态筛选各自生效', () => {
  const rows = gradedRows()

  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'NOT_SUBMITTED', courseId: 'ALL' }).map(
      ({ assignment }) => assignment.id,
    ),
    [3001],
  )
  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'SUBMITTED', courseId: 'ALL' }).map(
      ({ assignment }) => assignment.id,
    ),
    [3002],
  )
  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'GRADED', courseId: 'ALL' }).map(
      ({ assignment }) => assignment.id,
    ),
    [3004],
  )
  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'REVISION_REQUIRED', courseId: 'ALL' }).map(
      ({ assignment }) => assignment.id,
    ),
    [3003],
  )
})

test('课程筛选按课程隔离', () => {
  const rows = listAssignmentRows(createStudentOverviewFixture())

  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'ALL', courseId: 11 }).map(
      ({ assignment }) => assignment.id,
    ),
    [3001, 3002],
  )
})

test('状态和课程组合筛选', () => {
  const rows = gradedRows()

  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'NOT_SUBMITTED', courseId: 11 }).map(
      ({ assignment }) => assignment.id,
    ),
    [3001],
  )
  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'SUBMITTED', courseId: 12 }),
    [],
  )
})

test('筛选无结果时返回空数组', () => {
  const rows = listAssignmentRows(createStudentOverviewFixture())

  assert.deepEqual(
    filterAssignmentRows(rows, { status: 'GRADED', courseId: 'ALL' }),
    [],
  )
})

test('课程筛选选项只包含有作业的课程', () => {
  const overview = createStudentOverviewFixture()
  const rows = listAssignmentRows(overview)

  assert.deepEqual(listCourseFilterOptions(rows, overview.courses), [
    { courseId: 11, name: '数学提高班' },
    { courseId: 12, name: '英语阅读班' },
  ])
})
