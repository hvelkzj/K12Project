import type { CourseSummary } from '@k12/shared'

interface SubjectPresentation {
  code: string
  icon: string
}

const subjectPresentations: Record<string, SubjectPresentation> = {
  数学: { code: 'MATH', icon: '∫' },
  语文: { code: 'CHN', icon: '文' },
  英语: { code: 'ENG', icon: 'A' },
  科学: { code: 'SCI', icon: '⚗' },
}

function findCourse(
  courses: readonly CourseSummary[],
  courseId: number,
): CourseSummary | undefined {
  return courses.find((course) => course.id === courseId)
}

export function getCourseDisplayName(
  courses: readonly CourseSummary[],
  courseId: number,
): string {
  return findCourse(courses, courseId)?.name ?? `课程 #${courseId}`
}

export function getCourseDisplayCode(
  courses: readonly CourseSummary[],
  courseId: number,
): string {
  const subject = findCourse(courses, courseId)?.subject.trim()
  if (!subject) return `COURSE-${courseId}`
  return subjectPresentations[subject]?.code ?? subject.toLocaleUpperCase('en-US')
}

export function getCourseDisplayIcon(
  courses: readonly CourseSummary[],
  courseId: number,
): string {
  const subject = findCourse(courses, courseId)?.subject.trim()
  if (!subject) return '书'
  return subjectPresentations[subject]?.icon ?? subject.slice(0, 1)
}
