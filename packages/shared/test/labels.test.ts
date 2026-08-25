import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUSINESS_STATUS_LABELS,
  getBusinessStatusLabel,
} from '../src/labels.js'

test('面向业务用户的公共状态都有中文标签', () => {
  assert.equal(BUSINESS_STATUS_LABELS.PENDING_PARENT, '待家长确认')
  assert.equal(BUSINESS_STATUS_LABELS.SUBMITTED, '已提交，待批改')
  assert.equal(BUSINESS_STATUS_LABELS.LEAVE, '请假')
  assert.equal(BUSINESS_STATUS_LABELS.SUBSTITUTE_ASSIGNED, '已安排代课')
})

test('未知状态保持原值，避免页面渲染空白', () => {
  assert.equal(getBusinessStatusLabel('UNKNOWN_STATUS'), 'UNKNOWN_STATUS')
})
