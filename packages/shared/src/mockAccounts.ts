import type { UserRole } from './constants.js'
import type { UserSummary } from './types.js'

export const MOCK_ACCOUNT_PASSWORD = 'K12Demo123!'

export interface MockAccount {
  username: string
  password: string
  active: boolean
  user: UserSummary
}

export const MOCK_ACCOUNTS = [
  {
    username: 'parent_201',
    password: MOCK_ACCOUNT_PASSWORD,
    active: true,
    user: {
      id: 201,
      displayName: '林女士',
      role: 'PARENT',
      campusId: 1,
      campusName: '滨江校区',
    },
  },
  {
    username: 'student_101',
    password: MOCK_ACCOUNT_PASSWORD,
    active: true,
    user: {
      id: 101,
      displayName: '林晓雨',
      role: 'STUDENT',
      campusId: 1,
      campusName: '滨江校区',
    },
  },
  {
    username: 'teacher_301',
    password: MOCK_ACCOUNT_PASSWORD,
    active: true,
    user: {
      id: 301,
      displayName: '李老师',
      role: 'TEACHER',
      campusId: 1,
      campusName: '滨江校区',
    },
  },
  {
    username: 'teacher_302',
    password: MOCK_ACCOUNT_PASSWORD,
    active: true,
    user: {
      id: 302,
      displayName: '周老师',
      role: 'HOMEROOM_TEACHER',
      campusId: 1,
      campusName: '滨江校区',
    },
  },
  {
    username: 'academic_901',
    password: MOCK_ACCOUNT_PASSWORD,
    active: true,
    user: {
      id: 901,
      displayName: '许教务',
      role: 'ACADEMIC_ADMIN',
      campusId: 1,
      campusName: '滨江校区',
    },
  },
  {
    username: 'system_999',
    password: MOCK_ACCOUNT_PASSWORD,
    active: true,
    user: {
      id: 999,
      displayName: '系统管理员',
      role: 'SYSTEM_ADMIN',
      campusId: 1,
      campusName: '滨江校区',
    },
  },
] as const satisfies readonly MockAccount[]

export const MOCK_ACCOUNT_ROLES = MOCK_ACCOUNTS.map(
  ({ user }) => user.role,
) as readonly UserRole[]
