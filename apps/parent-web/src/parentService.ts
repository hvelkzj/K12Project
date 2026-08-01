import { feedbackList, notices, parentUser, schedules, students } from './mockData';
import type { FeedbackStatus, LeaveRequest, ParentNotice, ScheduleItem, Student, StudentFeedback } from './types';

const leaveRequests: LeaveRequest[] = [];

export function getBoundStudents(): Student[] {
  return students.filter((student) => parentUser.boundStudentIds.includes(student.id));
}

export function ensureBoundStudent(studentId: string): void {
  if (!parentUser.boundStudentIds.includes(studentId)) {
    throw new Error('家长只能查看已绑定学生的数据');
  }
}

export function getSchedulesByStudent(studentId: string): ScheduleItem[] {
  ensureBoundStudent(studentId);
  return schedules.filter((schedule) => schedule.studentId === studentId);
}

export function getNoticesByStudent(studentId: string): ParentNotice[] {
  ensureBoundStudent(studentId);
  return notices.filter((notice) => notice.studentId === studentId);
}

export function getFeedbackByStudent(studentId: string): StudentFeedback[] {
  ensureBoundStudent(studentId);
  return feedbackList.filter((feedback) => feedback.studentId === studentId);
}

export function submitLeaveRequest(input: {
  studentId: string;
  scheduleId: string;
  reason: string;
  contactPhone: string;
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

  const request: LeaveRequest = {
    id: `leave-${leaveRequests.length + 1}`.padStart(9, '0'),
    studentId: input.studentId,
    scheduleId: input.scheduleId,
    reason: input.reason.trim(),
    contactPhone: input.contactPhone,
    status: 'submitted',
    createdAt: new Date().toISOString()
  };

  leaveRequests.push(request);
  return request;
}

export function updateFeedbackStatus(feedbackId: string, status: FeedbackStatus): StudentFeedback {
  const feedback = feedbackList.find((item) => item.id === feedbackId);

  if (!feedback) {
    throw new Error('反馈不存在');
  }

  ensureBoundStudent(feedback.studentId);
  feedback.status = status;
  return feedback;
}

export function listLeaveRequests(): LeaveRequest[] {
  return [...leaveRequests];
}
