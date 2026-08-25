import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  formatChinaDate,
  formatChinaDateTime,
  formatChinaShortDateTime,
} from './mobileDateTime'

test('移动端时间固定按中国标准时间显示中文年月日', () => {
  assert.equal(
    formatChinaDateTime('2026-08-27T12:00:00.000Z'),
    '2026年8月27日 20:00',
  )
  assert.equal(
    formatChinaDateTime('2026-08-27T20:00:00+08:00'),
    '2026年8月27日 20:00',
  )
})

test('中国时区换日和精简日期格式不受设备语言影响', () => {
  const value = '2026-08-24T16:30:00.000Z'
  assert.equal(formatChinaDateTime(value), '2026年8月25日 00:30')
  assert.equal(formatChinaShortDateTime(value), '8月25日 00:30')
  assert.equal(formatChinaDate(value), '2026年8月25日')
})

test('无效业务时间显示中文待确认提示', () => {
  assert.equal(formatChinaDateTime('invalid'), '时间待确认')
  assert.equal(formatChinaShortDateTime(''), '时间待确认')
  assert.equal(formatChinaDate('invalid'), '日期待确认')
})

test('移动业务页面不再依赖设备语言格式化时间', () => {
  const pagePaths = [
    './pages/home/index.vue',
    './pages/assignments/index.vue',
    './pages/assignment-detail/index.vue',
    './pages/courseware/index.vue',
  ]
  const source = pagePaths
    .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
    .join('\n')
  assert.doesNotMatch(source, /toLocale(?:Date)?String|GMT\+|\(CST\)/)
  assert.match(source, /formatChina(?:Short)?DateTime|formatChinaDate/)
})
