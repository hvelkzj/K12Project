import {
  PUBLIC_REGISTRATION_ROLES,
  type PublicRegistrationRole,
  type RegisterRequest,
} from '@k12/shared'

export interface RegistrationForm {
  username: string
  displayName: string
  password: string
  confirmPassword: string
  role: PublicRegistrationRole
}

export type RegistrationValidation =
  | { ok: true; value: RegisterRequest }
  | { ok: false; message: string }

const usernamePattern = /^[a-z][a-z0-9_]{3,23}$/

export function validateRegistration(
  form: RegistrationForm,
): RegistrationValidation {
  const username = form.username.trim()
  const displayName = form.displayName.trim()

  if (!usernamePattern.test(username)) {
    return {
      ok: false,
      message: '用户名需以小写字母开头，并使用 4–24 位小写字母、数字或下划线。',
    }
  }
  if (displayName.length < 2 || displayName.length > 20) {
    return { ok: false, message: '姓名或称呼需为 2–20 个字符。' }
  }
  if (
    form.password.length < 8 ||
    form.password.length > 64 ||
    !/[A-Za-z]/.test(form.password) ||
    !/\d/.test(form.password)
  ) {
    return { ok: false, message: '密码需为 8–64 位，并同时包含字母和数字。' }
  }
  if (form.password !== form.confirmPassword) {
    return { ok: false, message: '两次输入的密码不一致。' }
  }
  if (!PUBLIC_REGISTRATION_ROLES.includes(form.role)) {
    return { ok: false, message: '公开注册只支持家长或学生账号。' }
  }

  return {
    ok: true,
    value: {
      username,
      displayName,
      password: form.password,
      role: form.role,
    },
  }
}
