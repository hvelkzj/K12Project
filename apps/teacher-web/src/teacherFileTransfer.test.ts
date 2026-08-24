import assert from 'node:assert/strict'
import test from 'node:test'

import {
  teacherAttachmentMimeType,
  validateTeacherAttachment,
} from './teacherFileTransfer'

test('教师附件按浏览器类型或扩展名识别', () => {
  const pdf = new File(['pdf'], '教学资料.pdf', { type: '' })
  const jpg = new File(['jpg'], '课堂照片.jpg', { type: 'image/jpeg' })
  assert.equal(teacherAttachmentMimeType(pdf), 'application/pdf')
  assert.equal(teacherAttachmentMimeType(jpg), 'image/jpeg')
})

test('教师附件拒绝空文件、未知类型和超过 10 MB', () => {
  assert.throws(
    () => validateTeacherAttachment(new File([], 'empty.pdf')),
    /不能为空/,
  )
  assert.throws(
    () => validateTeacherAttachment(new File(['x'], 'script.exe')),
    /仅支持/,
  )
  assert.throws(
    () =>
      validateTeacherAttachment(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf'),
      ),
    /10 MB/,
  )
})
