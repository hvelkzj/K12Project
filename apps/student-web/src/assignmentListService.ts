import type { AssignmentListRow } from './assignmentPresentation'
import type { StudentOverview } from './studentBusinessClient'
import {
  getLatestSubmission,
  listAssignments,
} from './studentService'

export function listAssignmentRows(
  overview: StudentOverview,
): AssignmentListRow[] {
  return listAssignments(overview).map((assignment) => {
    const latestSubmission = getLatestSubmission(overview, assignment.id)

    return {
      assignment,
      status: latestSubmission?.status ?? 'NOT_SUBMITTED',
      latestSubmission,
    }
  })
}
