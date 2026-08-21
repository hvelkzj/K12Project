import type { CourseSummary } from '@k12/shared'

import type { AssignmentListRow } from './assignmentPresentation'
import type { SubmissionViewStatus } from './types'

export type AssignmentStatusFilter = 'ALL' | SubmissionViewStatus

export interface AssignmentFilters {
  status: AssignmentStatusFilter
  courseId: number | 'ALL'
}

export interface CourseFilterOption {
  courseId: number
  name: string
}

export const assignmentStatusFilters: readonly AssignmentStatusFilter[] = [
  'ALL',
  'NOT_SUBMITTED',
  'SUBMITTED',
  'GRADED',
  'REVISION_REQUIRED',
]

export function filterAssignmentRows(
  rows: readonly AssignmentListRow[],
  filters: AssignmentFilters,
): AssignmentListRow[] {
  return rows.filter((row) => {
    if (filters.status !== 'ALL' && row.status !== filters.status) return false
    if (filters.courseId !== 'ALL' && row.assignment.courseId !== filters.courseId) {
      return false
    }
    return true
  })
}

export function listCourseFilterOptions(
  rows: readonly AssignmentListRow[],
  courses: readonly CourseSummary[],
): CourseFilterOption[] {
  const usedCourseIds = new Set(
    rows.map((row) => row.assignment.courseId),
  )

  return courses
    .filter((course) => usedCourseIds.has(course.id))
    .map((course) => ({ courseId: course.id, name: course.name }))
}
