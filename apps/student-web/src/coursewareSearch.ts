import type { Courseware } from '@k12/shared'

export function filterCoursewareByTitle(
  materials: readonly Courseware[],
  query: string,
): Courseware[] {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return [...materials]

  return materials.filter((material) =>
    material.title.toLowerCase().includes(keyword),
  )
}
