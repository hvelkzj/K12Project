import type { ParentNotice, ParentUser, ScheduleItem, Student, StudentFeedback } from './types';

export const parentUser: ParentUser = {
  id: 'parent-001',
  name: '王女士',
  phone: '13800000001',
  boundStudentIds: ['student-001', 'student-002']
};

export const students: Student[] = [
  { id: 'student-001', name: '王小明', className: '三年级 1 班', campusName: '东校区' },
  { id: 'student-002', name: '王小雨', className: '一年级 2 班', campusName: '东校区' },
  { id: 'student-999', name: '未绑定学生', className: '五年级 1 班', campusName: '西校区' }
];

export const schedules: ScheduleItem[] = [
  {
    id: 'schedule-001',
    studentId: 'student-001',
    date: '2026-08-01',
    startTime: '09:00',
    endTime: '10:30',
    courseName: '数学提高',
    teacherName: '李老师',
    roomName: 'A203'
  },
  {
    id: 'schedule-002',
    studentId: 'student-001',
    date: '2026-08-02',
    startTime: '14:00',
    endTime: '15:30',
    courseName: '英语阅读',
    teacherName: '陈老师',
    roomName: 'B102'
  },
  {
    id: 'schedule-003',
    studentId: 'student-002',
    date: '2026-08-01',
    startTime: '10:40',
    endTime: '12:10',
    courseName: '拼音练习',
    teacherName: '赵老师',
    roomName: 'A105'
  }
];

export const notices: ParentNotice[] = [
  {
    id: 'notice-001',
    studentId: 'student-001',
    type: 'schedule_change',
    title: '数学提高调课通知',
    content: '李老师的数学提高课已完成调课审批。',
    originalTime: '2026-08-01 09:00-10:30',
    newTime: '2026-08-01 16:00-17:30',
    substituteTeacherName: '周老师',
    createdAt: '2026-07-31 18:30',
    read: false
  },
  {
    id: 'notice-002',
    studentId: 'student-002',
    type: 'general',
    title: '上课提醒',
    content: '请提前 10 分钟到达教室。',
    createdAt: '2026-07-31 19:10',
    read: true
  }
];

export const feedbackList: StudentFeedback[] = [
  {
    id: 'feedback-001',
    studentId: 'student-001',
    courseName: '英语阅读',
    teacherName: '陈老师',
    strengths: '课堂跟读积极，能主动回答问题。',
    improvements: '长句朗读还需要更稳定。',
    suggestion: '每天完成 10 分钟朗读打卡。',
    status: 'pending_parent'
  }
];
