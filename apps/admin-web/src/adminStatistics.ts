import type {
  FeedbackWorkOrder,
  LeaveRequest,
  ScheduleChange,
} from '@k12/shared'

export function countPendingScheduleChanges(
  changes: readonly ScheduleChange[],
  campusId: number,
): number {
  return changes.filter(
    (change) => change.campusId === campusId && change.status === 'PENDING',
  ).length
}

export function countPendingLeaveRequests(
  leaveRequests: readonly LeaveRequest[],
  campusId: number,
  campusOfLeave: (leave: LeaveRequest) => number,
): number {
  return leaveRequests.filter(
    (leave) => campusOfLeave(leave) === campusId && leave.status === 'PENDING',
  ).length
}

export function countOpenWorkOrders(
  workOrders: readonly FeedbackWorkOrder[],
  campusId: number,
): number {
  return workOrders.filter(
    (workOrder) =>
      workOrder.campusId === campusId && workOrder.status !== 'CLOSED',
  ).length
}

export function countTodaySchedules(
  schedules: ReadonlyArray<{ lessonDate: string }>,
  dateKey: string,
): number {
  return schedules.filter((schedule) => schedule.lessonDate === dateKey).length
}
