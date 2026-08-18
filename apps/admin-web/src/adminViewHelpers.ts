import type { ScheduleSummary } from '@k12/shared'

const businessTimeZone = 'Asia/Shanghai'

export function businessDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )

  return `${values.year}-${values.month}-${values.day}`
}

export function countSchedulesForBusinessDate(
  schedules: readonly ScheduleSummary[],
  now: Date,
): number {
  const dateKey = businessDateKey(now)
  return schedules.filter((schedule) => schedule.lessonDate === dateKey).length
}

export function chooseSubstituteTeacherId(
  currentTeacherId: number | null,
  candidates: ReadonlyArray<{ id: number }>,
): number | null {
  if (candidates.some((teacher) => teacher.id === currentTeacherId)) {
    return currentTeacherId
  }

  return candidates[0]?.id ?? null
}
