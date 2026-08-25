import assert from 'node:assert/strict'
import test from 'node:test'

import type { Assignment, FileSummary, LoginResponse, Submission } from '@k12/shared'
import { MOCK_ACCOUNT_PASSWORD } from '@k12/shared/mock-accounts'

import { createRequestHandler } from '../src/app.js'
import { createAuthService } from '../src/authService.js'
import { createBusinessStore } from '../src/businessStore.js'
import { callHandler, parseJsonBody } from './httpTestUtils.js'

const fixedNow = Date.parse('2026-08-24T10:00:00+08:00')

async function login(
  handler: ReturnType<typeof createRequestHandler>,
  username: string,
): Promise<string> {
  const response = await callHandler(handler, {
    method: 'POST',
    url: '/auth/login',
    jsonBody: { username, password: MOCK_ACCOUNT_PASSWORD },
  })
  assert.equal(response.status, 200)
  return parseJsonBody<LoginResponse>(response).accessToken
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

test('教师上传作业附件、学生下载并提交附件、教师下载提交形成真实闭环', async () => {
  let tokenNumber = 0
  const now = () => fixedNow
  const handler = createRequestHandler(
    createAuthService({ now, createToken: () => `file-token-${++tokenNumber}` }),
    createBusinessStore({ now }),
  )
  const teacher = await login(handler, 'teacher_301')
  const otherTeacher = await login(handler, 'teacher_302')
  const student = await login(handler, 'student_101')
  const parent = await login(handler, 'parent_201')

  const teacherBytes = Buffer.from('%PDF teacher assignment attachment')
  const teacherUpload = await callHandler(handler, {
    method: 'POST',
    url: '/teacher/files?name=%E5%88%86%E6%95%B0%E6%8C%87%E5%AF%BC.pdf',
    rawBody: teacherBytes,
    contentType: 'application/pdf',
    headers: auth(teacher),
  })
  assert.equal(teacherUpload.status, 201)
  const assignmentFile = parseJsonBody<FileSummary>(teacherUpload)
  assert.equal(assignmentFile.originalName, '分数指导.pdf')
  assert.equal(assignmentFile.byteSize, teacherBytes.byteLength)

  const publish = await callHandler(handler, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      title: '附件下载验收作业',
      description: '下载附件后完成并提交。',
      attachments: [assignmentFile],
      dueAt: '2026-08-27T20:00:00+08:00',
      allowLate: false,
    },
    headers: auth(teacher),
  })
  assert.equal(publish.status, 201)
  const assignment = parseJsonBody<Assignment>(publish)

  const studentDownload = await callHandler(handler, {
    method: 'GET',
    url: `/files/${assignmentFile.id}`,
    headers: auth(student),
  })
  assert.equal(studentDownload.status, 200)
  assert.deepEqual(studentDownload.bodyBuffer, teacherBytes)
  assert.match(
    String(studentDownload.headers.get('content-disposition')),
    /filename\*=UTF-8''/,
  )

  const studentBytes = Buffer.from('%PDF student submitted work')
  const studentUpload = await callHandler(handler, {
    method: 'POST',
    url: '/student/files?name=%E6%9E%97%E6%99%93%E9%9B%A8%E4%BD%9C%E4%B8%9A.pdf',
    rawBody: studentBytes,
    contentType: 'application/pdf',
    headers: auth(student),
  })
  assert.equal(studentUpload.status, 201)
  const submissionFile = parseJsonBody<FileSummary>(studentUpload)

  const submit = await callHandler(handler, {
    method: 'POST',
    url: '/student/submissions',
    jsonBody: {
      assignmentId: assignment.id,
      content: '附件中包含完整解题过程。',
      attachments: [submissionFile],
    },
    headers: auth(student),
  })
  assert.equal(submit.status, 201)
  assert.deepEqual(parseJsonBody<Submission>(submit).attachments, [submissionFile])

  const teacherDownload = await callHandler(handler, {
    method: 'GET',
    url: `/files/${submissionFile.id}`,
    headers: auth(teacher),
  })
  assert.equal(teacherDownload.status, 200)
  assert.deepEqual(teacherDownload.bodyBuffer, studentBytes)

  const otherTeacherDownload = await callHandler(handler, {
    method: 'GET',
    url: `/files/${submissionFile.id}`,
    headers: auth(otherTeacher),
  })
  assert.equal(otherTeacherDownload.status, 403)

  const parentDownload = await callHandler(handler, {
    method: 'GET',
    url: `/files/${assignmentFile.id}`,
    headers: auth(parent),
  })
  assert.equal(parentDownload.status, 403)
})

test('附件接口拒绝角色越权、空文件和伪造附件元数据', async () => {
  const now = () => fixedNow
  const handler = createRequestHandler(createAuthService({ now }), createBusinessStore({ now }))
  const student = await login(handler, 'student_101')
  const teacher = await login(handler, 'teacher_301')

  const wrongRole = await callHandler(handler, {
    method: 'POST',
    url: '/teacher/files?name=answer.pdf',
    rawBody: 'content',
    contentType: 'application/pdf',
    headers: auth(student),
  })
  assert.equal(wrongRole.status, 403)

  const empty = await callHandler(handler, {
    method: 'POST',
    url: '/student/files?name=answer.pdf',
    rawBody: '',
    contentType: 'application/pdf',
    headers: auth(student),
  })
  assert.equal(empty.status, 422)

  const forged = await callHandler(handler, {
    method: 'POST',
    url: '/teacher/assignments',
    jsonBody: {
      classId: 101,
      courseId: 11,
      scheduleId: 1001,
      title: '伪造附件',
      description: '不能发布。',
      attachments: [
        {
          id: 99_999,
          originalName: 'fake.pdf',
          mimeType: 'application/pdf',
          byteSize: 10,
          createdAt: '2026-08-24T02:00:00.000Z',
        },
      ],
      dueAt: '2026-08-27T20:00:00+08:00',
      allowLate: false,
    },
    headers: auth(teacher),
  })
  assert.equal(forged.status, 404)
})

test('移动端可以使用 base64 传输真实附件内容', async () => {
  const now = () => fixedNow
  const handler = createRequestHandler(
    createAuthService({ now }),
    createBusinessStore({ now }),
  )
  const student = await login(handler, 'student_101')
  const bytes = Buffer.from('mobile image bytes')
  const uploaded = await callHandler(handler, {
    method: 'POST',
    url: '/student/files?name=%E4%BD%9C%E4%B8%9A%E7%85%A7%E7%89%87.jpg',
    rawBody: bytes.toString('base64'),
    contentType: 'image/jpeg',
    headers: {
      ...auth(student),
      'content-transfer-encoding': 'base64',
    },
  })
  assert.equal(uploaded.status, 201)
  const file = parseJsonBody<FileSummary>(uploaded)
  assert.equal(file.byteSize, bytes.byteLength)

  const downloaded = await callHandler(handler, {
    method: 'GET',
    url: `/files/${file.id}`,
    headers: auth(student),
  })
  assert.equal(downloaded.status, 200)
  assert.deepEqual(downloaded.bodyBuffer, bytes)

  const invalid = await callHandler(handler, {
    method: 'POST',
    url: '/student/files?name=invalid.jpg',
    rawBody: '%%%not-base64%%%',
    contentType: 'image/jpeg',
    headers: {
      ...auth(student),
      'content-transfer-encoding': 'base64',
    },
  })
  assert.equal(invalid.status, 422)
})
