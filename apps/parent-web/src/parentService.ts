import {
  feedbackList,
  initialLeaveRequests,
  parentProfile,
  parentStudentBindings,
  notices,
  parentUser,
  schedules,
} from './mockData'
import type { LeaveRequest } from '@k12/shared'
import type {
  ParentFeedback,
  ParentNotice,
  ParentSchedule,
} from './mockData'

const leaveRequests: LeaveRequest[] = [...initialLeaveRequests]

export function getBoundStudents() {
  return parentStudentBindings.map((binding) => binding.student)
}

export function ensureBoundStudent(studentId: number): void {
  const isBound = parentStudentBindings.some(
    (binding) => binding.student.id === studentId,
  )

  if (!isBound) {
    throw new Error('家长只能查看已绑定学生的数据');
  }
}

export function getSchedulesByStudent(studentId: number): ParentSchedule[] {
  ensureBoundStudent(studentId);
  return schedules.filter((schedule) => schedule.studentId === studentId);
}

export function getNoticesByStudent(studentId: number): ParentNotice[] {
  ensureBoundStudent(studentId);
  return notices.filter((notice) =>
    'notification' in notice
      ? notice.notification.studentId === studentId
      : notice.studentId === studentId,
  );
}

export function getFeedbackByStudent(studentId: number): ParentFeedback[] {
  ensureBoundStudent(studentId);
  return feedbackList.filter((feedback) => feedback.studentId === studentId);
}

export function submitLeaveRequest(input: {
  studentId: number
  scheduleId: number
  reason: string
  contactPhone: string
}): LeaveRequest {
  ensureBoundStudent(input.studentId);

  const schedule = schedules.find(
    (item) => item.id === input.scheduleId && item.studentId === input.studentId
  );

  if (!schedule) {
    throw new Error('只能为当前学生的课程提交请假');
  }

  if (!input.reason.trim()) {
    throw new Error('请假原因不能为空');
  }

  const duplicateRequest = leaveRequests.find(
    (request) =>
      request.studentId === input.studentId &&
      request.scheduleId === input.scheduleId &&
      request.status === 'PENDING',
  )

  if (duplicateRequest) {
    throw new Error('该课程已提交待处理请假申请');
  }

  const now = new Date().toISOString()
  const request: LeaveRequest = {
    id: leaveRequests.length + 1,
    parentId: parentUser.id,
    studentId: input.studentId,
    scheduleId: input.scheduleId,
    reason: input.reason.trim(),
    contactPhone: input.contactPhone,
    status: 'PENDING',
    reviewedBy: null,
    reviewNote: '',
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  }

  leaveRequests.push(request);
  return request;
}

export function updateFeedbackStatus(
  feedbackId: number,
  status: 'CONFIRMED' | 'DISPUTED',
  parentResponse = '',
): ParentFeedback {
  const feedback = feedbackList.find((item) => item.id === feedbackId);

  if (!feedback) {
    throw new Error('反馈不存在');
  }

  if (status === 'DISPUTED' && !parentResponse.trim()) {
    throw new Error('提出异议时必须填写异议内容')
  }

  ensureBoundStudent(feedback.studentId)
  feedback.status = status
  feedback.parentResponse = status === 'DISPUTED' ? parentResponse.trim() : ''
  feedback.respondedBy = parentUser.id
  feedback.respondedAt = new Date().toISOString()
  feedback.updatedAt = feedback.respondedAt
  return feedback
}

export function listLeaveRequests(): LeaveRequest[] {
  return [...leaveRequests];
}

export function getParentContactPhone(): string {
  return parentProfile.phone
}

export function resetParentServiceState(): void {
  leaveRequests.splice(0, leaveRequests.length, ...initialLeaveRequests)
  for (const feedback of feedbackList) {
    feedback.status = 'PENDING_PARENT'
    feedback.parentResponse = ''
    feedback.respondedBy = null
    feedback.respondedAt = null
  }
}
