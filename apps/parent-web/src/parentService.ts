import {
  feedbackList,
  mockParentCredentials,
  notices,
  parentUser,
  schedules,
  students,
} from './mockData'
import type {
  LeaveRequest,
  ParentNotice,
  ParentUser,
  ScheduleItem,
  Student,
  StudentFeedback,
} from './types'

const leaveRequests: LeaveRequest[] = [];

export function authenticateParent(
  username: string,
  password: string,
): ParentUser {
  const validUsername = username.trim() === mockParentCredentials.username
  const validPassword = password === mockParentCredentials.password

  if (!validUsername || !validPassword) {
    throw new Error('账号或密码错误')
  }

  return parentUser
}

export function getBoundStudents(): Student[] {
  return students.filter((student) => parentUser.boundStudentIds.includes(student.id));
}

export function ensureBoundStudent(studentId: number): void {
  if (!parentUser.boundStudentIds.includes(studentId)) {
    throw new Error('家长只能查看已绑定学生的数据');
  }
}

export function getSchedulesByStudent(studentId: number): ScheduleItem[] {
  ensureBoundStudent(studentId);
  return schedules.filter((schedule) => schedule.studentId === studentId);
}

export function getNoticesByStudent(studentId: number): ParentNotice[] {
  ensureBoundStudent(studentId);
  return notices.filter((notice) => notice.studentId === studentId);
}

export function getFeedbackByStudent(studentId: number): StudentFeedback[] {
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

  const now = new Date().toISOString()
  const request: LeaveRequest = {
    id: leaveRequests.length + 1,
    parentId: parentUser.id,
    studentId: input.studentId,
    scheduleId: input.scheduleId,
    reason: input.reason.trim(),
    contactPhone: input.contactPhone,
    status: 'PENDING',
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
): StudentFeedback {
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
  return feedback
}

export function listLeaveRequests(): LeaveRequest[] {
  return [...leaveRequests];
}
