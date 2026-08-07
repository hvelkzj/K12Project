import type { AssignmentListRow } from './assignmentPresentation'
import {
  getLatestSubmission,
  listAssignments,
} from './studentService'

export function listAssignmentRows(studentId: number): AssignmentListRow[] {
  return listAssignments(studentId).map((assignment) => {
    const latestSubmission = getLatestSubmission(assignment.id, studentId)

    return {
      assignment,
      status: latestSubmission?.status ?? 'NOT_SUBMITTED',
      latestSubmission,
    }
  })
}
