import { TeacherBusinessError } from './teacherBusinessClient'

export interface TeacherOverviewLoadFailure {
  sessionExpired: boolean
  authMessage: string
  overviewLoadError: string
  notice: string
}

export function resolveTeacherOverviewLoadFailure(
  error: unknown,
): TeacherOverviewLoadFailure {
  if (error instanceof TeacherBusinessError && error.status === 401) {
    return {
      sessionExpired: true,
      authMessage: '登录已失效，请重新登录',
      overviewLoadError: '',
      notice: '',
    }
  }

  const message = error instanceof Error ? error.message : '教师数据加载失败'
  return {
    sessionExpired: false,
    authMessage: '',
    overviewLoadError: message,
    notice: message,
  }
}
