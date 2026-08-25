import type { ScheduleSummary, UserRole, UserSummary } from '@k12/shared'

export const TEACHER_ROLES = [
  'TEACHER',
  'HOMEROOM_TEACHER',
] as const satisfies readonly UserRole[]

export type TeacherRole = (typeof TEACHER_ROLES)[number]
export type TeacherUser = UserSummary & { role: TeacherRole }

export function isTeacherRole(role: UserRole): role is TeacherRole {
  return role === 'TEACHER' || role === 'HOMEROOM_TEACHER'
}

export function isTeacherUser(user: UserSummary): user is TeacherUser {
  return isTeacherRole(user.role)
}

export function teacherRoleName(role: TeacherRole): string {
  return role === 'TEACHER' ? '任课教师' : '班主任'
}

export function canUseHomeroomScope(user: TeacherUser): boolean {
  return user.role === 'HOMEROOM_TEACHER'
}

export function canWriteSchedule(
  user: TeacherUser,
  schedule: ScheduleSummary,
): boolean {
  return schedule.teacherId === user.id
}

export function visibleSchedulesForTeacher(
  user: TeacherUser,
  schedules: readonly ScheduleSummary[],
  homeroomClassIds: readonly number[],
): ScheduleSummary[] {
  return schedules
    .filter(
      (schedule) =>
        schedule.teacherId === user.id ||
        (canUseHomeroomScope(user) &&
          homeroomClassIds.includes(schedule.classId)),
    )
    .sort((left, right) => {
      const leftOwn = left.teacherId === user.id ? 0 : 1
      const rightOwn = right.teacherId === user.id ? 0 : 1
      return leftOwn - rightOwn || left.id - right.id
    })
}
