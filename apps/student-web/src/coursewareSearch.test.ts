import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Courseware } from '@k12/shared'

import { filterCoursewareByTitle } from './coursewareSearch'

const materials: Courseware[] = [
  {
    id: 2001,
    classId: 101,
    courseId: 11,
    teacherId: 301,
    title: '分数混合运算讲义',
    description: '复习运算顺序并完成课堂例题。',
    attachments: [],
    publishedAt: '2026-08-06T09:00:00+08:00',
  },
  {
    id: 2002,
    classId: 101,
    courseId: 12,
    teacherId: 302,
    title: 'Unit 2 Words',
    description: '跟读单词。',
    attachments: [],
    publishedAt: '2026-08-06T09:00:00+08:00',
  },
]

test('空查询返回全部课件', () => {
  assert.equal(filterCoursewareByTitle(materials, '').length, 2)
  assert.equal(filterCoursewareByTitle(materials, '   ').length, 2)
})

test('按标题关键字匹配课件', () => {
  assert.deepEqual(
    filterCoursewareByTitle(materials, '分数').map((item) => item.id),
    [2001],
  )
})

test('搜索忽略首尾空格', () => {
  assert.deepEqual(
    filterCoursewareByTitle(materials, '  分数  ').map((item) => item.id),
    [2001],
  )
})

test('英文标题搜索不区分大小写', () => {
  assert.deepEqual(
    filterCoursewareByTitle(materials, 'unit 2').map((item) => item.id),
    [2002],
  )
  assert.deepEqual(
    filterCoursewareByTitle(materials, 'words').map((item) => item.id),
    [2002],
  )
})

test('没有匹配结果时返回空数组', () => {
  assert.deepEqual(filterCoursewareByTitle(materials, '不存在的课件'), [])
})

test('空课件列表搜索返回空数组', () => {
  assert.deepEqual(filterCoursewareByTitle([], '分数'), [])
})
