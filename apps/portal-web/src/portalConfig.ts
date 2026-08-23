import type { PublicRegistrationRole, UserRole } from '@k12/shared'

export interface PortalEntry {
  audience: string
  description: string
  eyebrow: string
  image: string
  role: UserRole
  title: string
  url: string
}

export const DEFAULT_PORTAL_URLS = {
  parent: 'http://127.0.0.1:5173',
  student: 'http://127.0.0.1:5174',
  teacher: 'http://127.0.0.1:5175',
  admin: 'http://127.0.0.1:5176',
} as const

export interface PortalUrls {
  parent: string
  student: string
  teacher: string
  admin: string
}

export function createPortalEntries(
  urls: PortalUrls = DEFAULT_PORTAL_URLS,
): PortalEntry[] {
  return [
    {
      role: 'PARENT',
      eyebrow: '家校连接',
      title: '家长端',
      audience: '家长',
      description: '查看课表与通知，提交请假，确认课后反馈。',
      image: '/previews/parent-dashboard.jpg',
      url: urls.parent,
    },
    {
      role: 'STUDENT',
      eyebrow: '自主学习',
      title: '学生端',
      audience: '学生',
      description: '获取课件，完成作业与订正，查看教师批改结果。',
      image: '/previews/student-dashboard.jpg',
      url: urls.student,
    },
    {
      role: 'TEACHER',
      eyebrow: '教学管理',
      title: '教师端',
      audience: '教师 / 班主任',
      description: '课堂签到，发布与批改作业，发送反馈和申请调课。',
      image: '/previews/teacher-dashboard.jpg',
      url: urls.teacher,
    },
    {
      role: 'ACADEMIC_ADMIN',
      eyebrow: '运营协同',
      title: '教务后台',
      audience: '教务 / 系统管理员',
      description: '排课与审批、代课安排、反馈工单、账号和数据看板。',
      image: '/previews/admin-dashboard.jpg',
      url: urls.admin,
    },
  ]
}

export function loginUrlForRole(
  role: PublicRegistrationRole,
  urls: PortalUrls = DEFAULT_PORTAL_URLS,
): string {
  return role === 'PARENT' ? urls.parent : urls.student
}
