import type {
  AttendanceRecord,
  LeaveRequest,
  ScheduleSummary,
  StudentSummary,
} from '@k12/shared'

import type { AttendanceDraft } from './teacherWorkflow'

const leaveStatusPriority: Record<LeaveRequest['status'], number> = {
  APPROVED: 0,
  PENDING: 1,
  REJECTED: 2,
}

function matchingLeaves(
  leaveRequests: readonly LeaveRequest[],
  scheduleId: number,
  studentId: number,
): LeaveRequest[] {
  return leaveRequests
    .filter(
      (item) =>
        item.scheduleId === scheduleId && item.studentId === studentId,
    )
    .sort(
      (left, right) =>
        leaveStatusPriority[left.status] - leaveStatusPriority[right.status] ||
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )
}

export function visibleLeaveForStudent(
  leaveRequests: readonly LeaveRequest[],
  scheduleId: number,
  studentId: number,
): LeaveRequest | undefined {
  return matchingLeaves(leaveRequests, scheduleId, studentId).find(
    (item) => item.status === 'APPROVED' || item.status === 'PENDING',
  )
}

export function leaveBadgeText(leaveRequest: LeaveRequest): string {
  return leaveRequest.status === 'APPROVED' ? '已批准请假' : '请假待审批'
}

export function buildAttendanceDrafts(input: {
  students: readonly Pick<StudentSummary, 'id'>[]
  scheduleId: number
  attendance: readonly AttendanceRecord[]
  leaveRequests: readonly LeaveRequest[]
}): AttendanceDraft[] {
  const existing = new Map(
    input.attendance
      .filter((item) => item.scheduleId === input.scheduleId)
      .map((item) => [item.studentId, item]),
  )

  return input.students.map((student) => {
    const attendance = existing.get(student.id)
    const approvedLeave = matchingLeaves(
      input.leaveRequests,
      input.scheduleId,
      student.id,
    ).find((item) => item.status === 'APPROVED')

    return {
      studentId: student.id,
      status: approvedLeave ? 'LEAVE' : (attendance?.status ?? 'PRESENT'),
      note: attendance?.note ?? '',
    }
  })
}

export function assertApprovedLeavesUseLeave(input: {
  drafts: readonly AttendanceDraft[]
  leaveRequests: readonly LeaveRequest[]
  scheduleId: number
}): void {
  const invalidDraft = input.drafts.find((draft) =>
    matchingLeaves(
      input.leaveRequests,
      input.scheduleId,
      draft.studentId,
    ).some(
      (leaveRequest) =>
        leaveRequest.status === 'APPROVED' && draft.status !== 'LEAVE',
    ),
  )
  if (invalidDraft) {
    throw new Error('已批准请假的学生只能登记为 LEAVE')
  }
}

export function isScheduleCancelled(
  schedule: ScheduleSummary | null | undefined,
): boolean {
  return schedule?.status === 'CANCELLED'
}

export function assertScheduleActive(schedule: ScheduleSummary): void {
  if (isScheduleCancelled(schedule)) {
    throw new Error('已取消课次不能执行教学写操作')
  }
}

export async function saveAttendanceAndApply(input: {
  save: () => Promise<AttendanceRecord[]>
  apply: (created: AttendanceRecord[]) => void
}): Promise<AttendanceRecord[]> {
  const created = await input.save()
  input.apply(created)
  return created
}
