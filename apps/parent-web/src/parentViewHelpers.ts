import type {
  ParentStudentBinding,
  StudentFeedback,
} from '@k12/shared'

export function overviewRetryStudentId(
  bindings: readonly ParentStudentBinding[],
  selectedStudentId: number | null,
): number | null {
  if (selectedStudentId === null) return null

  return bindings.some(
    (binding) => binding.student.id === selectedStudentId,
  )
    ? selectedStudentId
    : null
}

export function countPendingParentFeedback(
  feedback: readonly StudentFeedback[],
): number {
  return feedback.filter((item) => item.status === 'PENDING_PARENT').length
}
