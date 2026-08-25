import assert from 'node:assert/strict'
import test from 'node:test'

import {
  validateRegistration,
  type RegistrationForm,
} from './registrationRules'

const validForm: RegistrationForm = {
  username: 'student_demo',
  displayName: '演示学生',
  password: 'Study2026',
  confirmPassword: 'Study2026',
  role: 'STUDENT',
}

test('注册表单去除首尾空白并生成公共请求', () => {
  const result = validateRegistration({
    ...validForm,
    username: ' student_demo ',
    displayName: ' 演示学生 ',
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.value, {
      username: 'student_demo',
      displayName: '演示学生',
      password: 'Study2026',
      role: 'STUDENT',
    })
  }
})

test('注册表单拦截用户名、姓名、密码和确认密码错误', () => {
  const invalidForms: RegistrationForm[] = [
    { ...validForm, username: 'StudentDemo' },
    { ...validForm, displayName: 'A' },
    { ...validForm, password: 'onlyletters', confirmPassword: 'onlyletters' },
    { ...validForm, confirmPassword: 'Different2026' },
  ]

  for (const form of invalidForms) {
    assert.equal(validateRegistration(form).ok, false)
  }
})
