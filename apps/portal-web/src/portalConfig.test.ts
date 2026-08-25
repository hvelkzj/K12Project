import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPortalEntries,
  DEFAULT_PORTAL_URLS,
  loginUrlForRole,
} from './portalConfig'

test('统一入口包含四个独立角色工作区', () => {
  const entries = createPortalEntries()

  assert.equal(entries.length, 4)
  assert.deepEqual(
    entries.map(({ title }) => title),
    ['家长端', '学生端', '教师端', '教务后台'],
  )
  assert.equal(new Set(entries.map(({ url }) => url)).size, 4)
  assert.equal(
    entries.every(({ image }) => image.startsWith('/previews/')),
    true,
  )
})

test('注册成功后只跳转到家长端或学生端', () => {
  assert.equal(loginUrlForRole('PARENT'), DEFAULT_PORTAL_URLS.parent)
  assert.equal(loginUrlForRole('STUDENT'), DEFAULT_PORTAL_URLS.student)
})
