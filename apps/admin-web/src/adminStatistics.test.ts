import assert from 'node:assert/strict'
import test from 'node:test'

import {
  countOpenWorkOrders,
  countPendingLeaveRequests,
  countPendingScheduleChanges,
} from './adminStatistics'
import type {
  FeedbackWorkOrder,
  LeaveRequest,
  ScheduleChange,
} from './types'

const scheduleChanges: ScheduleChange[] = [
  {
    id: 7001,
    campusId: 1,
    scheduleId: 1001,
    requestedBy: 301,
    reason: '教研',
    originalTeacherId: 301,
    originalDate: '2026-08-22',
    originalStartTime: '09:00:00',
    originalEndTime: '10:30:00',
    proposedDate: '2026-08-23',
    proposedStartTime: '16:00:00',
    proposedEndTime: '17:30:00',
    status: 'PENDING',
    decisionNote: '',
    substituteNote: '',
    createdAt: '2026-08-20T09:00:00+08:00',
    updatedAt: '2026-08-20T09:00:00+08:00',
  },
  {
    id: 7002,
    campusId: 2,
    scheduleId: 2001,
    requestedBy: 401,
    reason: '外出',
    originalTeacherId: 401,
    originalDate: '2026-08-22',
    originalStartTime: '10:00:00',
    originalEndTime: '11:30:00',
    proposedDate: '2026-08-23',
    proposedStartTime: '10:00:00',
    proposedEndTime: '11:30:00',
    status: 'APPROVED',
    decisionNote: '同意',
    reviewedBy: 999,
    reviewedAt: '2026-08-20T10:00:00+08:00',
    substituteNote: '',
    createdAt: '2026-08-20T09:30:00+08:00',
    updatedAt: '2026-08-20T10:00:00+08:00',
  },
]

const leaveRequests: LeaveRequest[] = [
  {
    id: 9001,
    parentId: 201,
    studentId: 102,
    scheduleId: 1002,
    reason: '感冒',
    contactPhone: '13800000000',
    status: 'PENDING',
    reviewNote: '',
    createdAt: '2026-08-20T09:00:00+08:00',
    updatedAt: '2026-08-20T09:00:00+08:00',
  },
  {
    id: 9002,
    parentId: 201,
    studentId: 101,
    scheduleId: 1001,
    reason: '事假',
    contactPhone: '13800000000',
    status: 'APPROVED',
    reviewNote: '同意',
    reviewedBy: 901,
    reviewedAt: '2026-08-20T10:00:00+08:00',
    createdAt: '2026-08-20T09:30:00+08:00',
    updatedAt: '2026-08-20T10:00:00+08:00',
  },
]

const workOrders: FeedbackWorkOrder[] = [
  {
    id: 6001,
    feedbackId: 501,
    campusId: 1,
    issue: '异议',
    status: 'OPEN',
    result: '',
    createdAt: '2026-08-20T09:00:00+08:00',
    updatedAt: '2026-08-20T09:00:00+08:00',
  },
  {
    id: 6002,
    feedbackId: 502,
    campusId: 1,
    issue: '异议2',
    status: 'CLOSED',
    result: '已处理',
    createdAt: '2026-08-19T09:00:00+08:00',
    updatedAt: '2026-08-20T08:00:00+08:00',
    closedAt: '2026-08-20T08:00:00+08:00',
  },
]

test('待审批调课按校区统计', () => {
  assert.equal(countPendingScheduleChanges(scheduleChanges, 1), 1)
  assert.equal(countPendingScheduleChanges(scheduleChanges, 2), 0)
})

test('待审批请假按校区统计', () => {
  const campusOfLeave = (leave: LeaveRequest) => {
    if (leave.scheduleId === 1002) return 1
    return 0
  }

  assert.equal(countPendingLeaveRequests(leaveRequests, 1, campusOfLeave), 1)
  assert.equal(countPendingLeaveRequests(leaveRequests, 2, campusOfLeave), 0)
})

test('未关闭工单按校区统计', () => {
  assert.equal(countOpenWorkOrders(workOrders, 1), 1)
  assert.equal(countOpenWorkOrders(workOrders, 2), 0)
})
