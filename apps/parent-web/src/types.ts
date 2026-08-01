export type LeaveStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type NoticeType = 'schedule_change' | 'feedback' | 'general';
export type FeedbackStatus = 'pending_parent' | 'confirmed' | 'disputed';

export interface ParentUser {
  id: string;
  name: string;
  phone: string;
  boundStudentIds: string[];
}

export interface Student {
  id: string;
  name: string;
  className: string;
  campusName: string;
}

export interface ScheduleItem {
  id: string;
  studentId: string;
  date: string;
  startTime: string;
  endTime: string;
  courseName: string;
  teacherName: string;
  roomName: string;
}

export interface LeaveRequest {
  id: string;
  studentId: string;
  scheduleId: string;
  reason: string;
  contactPhone: string;
  status: LeaveStatus;
  createdAt: string;
}

export interface ParentNotice {
  id: string;
  studentId: string;
  type: NoticeType;
  title: string;
  content: string;
  originalTime?: string;
  newTime?: string;
  substituteTeacherName?: string;
  createdAt: string;
  read: boolean;
}

export interface StudentFeedback {
  id: string;
  studentId: string;
  courseName: string;
  teacherName: string;
  strengths: string;
  improvements: string;
  suggestion: string;
  status: FeedbackStatus;
}
