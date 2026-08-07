// src/mock/assignment.ts

// 1. 定义更丰富的类型
export interface Assignment {
  assignment_id: string;
  course_id: string;      // 简短名称，如 MATH
  course_name: string;    // 完整名称，如 数学
  title: string;
  description: string;
  deadline: string;       // 截止时间
  countdown: string;      // 倒计时时间描述，如 "剩余: 2天"
  status: '未提交' | '已提交' | '已批改' | '需订正';
  visual_progress: number; // 0 到 1 之间的小数，如 0, 0.5, 1
  visual_progress_text: string; // 如 "0/1 已完成"
  score?: number;         // 数字得分
  score_grade?: string;   // 等级得分，如 A+
  score_color?: string;   // 得分颜色，如 #52c41a
  teacher_feedback_preview?: string; // 老师评语预览
}

// 2. 提供更详尽的 Mock 数据
export const mockAssignments: Assignment[] = [
  {
    assignment_id: 'A001',
    course_id: 'MATH', // 去掉了 101
    course_name: '数学',
    title: '第一周数学作业：一元二次方程',
    description: '请完成课后习题 1-5 题，并拍照上传过程。',
    deadline: '2026-08-05T23:59:59',
    countdown: '剩余: 2天',
    status: '未提交',
    visual_progress: 0,
    visual_progress_text: '0/1 已完成'
  },
  {
    assignment_id: 'A002',
    course_id: 'ENG', // 去掉了 101
    course_name: '英语',
    title: '第一周英语作业：阅读理解',
    description: '阅读附件文章，完成选择题。',
    deadline: '2026-08-01T23:59:59',
    countdown: '已截止',
    status: '已批改',
    visual_progress: 1,
    visual_progress_text: '1/1 已批改',
    score: 95,
    score_grade: 'A+',
    score_color: '#52c41a',
    teacher_feedback_preview: '鲜露老师：做得非常好，再接再厉！'
  },
  {
    assignment_id: 'A003',
    course_id: 'PHY', // 去掉了 101
    course_name: '物理',
    title: '物理实验报告',
    description: '提交本次测量的实验数据及误差分析。',
    deadline: '2026-08-10T23:59:59',
    countdown: '剩余: 7天',
    status: '需订正',
    visual_progress: 0.5,
    visual_progress_text: '待订正'
  }
];

// 3. 计算全局完成率（示例）
export const calculateGlobalProgress = (assignments: Assignment[]): number => {
  if (assignments.length === 0) return 0;
  const completed = assignments.filter(a => a.status === '已批改' || a.status === '已提交').length;
  return Math.round((completed / assignments.length) * 100);
};
