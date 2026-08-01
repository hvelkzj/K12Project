import { describe, expect, it } from 'vitest';
import {
  ensureBoundStudent,
  getNoticesByStudent,
  getSchedulesByStudent,
  submitLeaveRequest,
  updateFeedbackStatus
} from './parentService';

describe('parent week 1 mock flow', () => {
  it('allows parent to view a bound student schedule', () => {
    expect(getSchedulesByStudent('student-001')).toHaveLength(2);
  });

  it('blocks access to an unbound student', () => {
    expect(() => ensureBoundStudent('student-999')).toThrow('家长只能查看已绑定学生的数据');
  });

  it('submits leave for the selected student schedule', () => {
    const request = submitLeaveRequest({
      studentId: 'student-001',
      scheduleId: 'schedule-001',
      reason: '身体不适',
      contactPhone: '13800000001'
    });

    expect(request.status).toBe('submitted');
    expect(request.reason).toBe('身体不适');
  });

  it('shows schedule change notice fields for parent', () => {
    const notice = getNoticesByStudent('student-001').find((item) => item.type === 'schedule_change');

    expect(notice?.originalTime).toBe('2026-08-01 09:00-10:30');
    expect(notice?.newTime).toBe('2026-08-01 16:00-17:30');
    expect(notice?.substituteTeacherName).toBe('周老师');
  });

  it('lets parent confirm or dispute feedback', () => {
    expect(updateFeedbackStatus('feedback-001', 'confirmed').status).toBe('confirmed');
    expect(updateFeedbackStatus('feedback-001', 'disputed').status).toBe('disputed');
  });
});
