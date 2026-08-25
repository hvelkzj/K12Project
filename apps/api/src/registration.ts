import {
  PUBLIC_REGISTRATION_ROLES,
  type RegisterRequest,
} from '@k12/shared'

export type RegisterRequestResult =
  | { ok: true; value: RegisterRequest }
  | { ok: false; message: string }

const usernamePattern = /^[a-z][a-z0-9_]{3,23}$/

export function parseRegisterRequest(value: unknown): RegisterRequestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: '请求体必须是 JSON 对象' }
  }

  const input = value as Record<string, unknown>
  const username =
    typeof input.username === 'string' ? input.username.trim() : ''
  const displayName =
    typeof input.displayName === 'string' ? input.displayName.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const role = input.role

  if (!usernamePattern.test(username)) {
    return {
      ok: false,
      message: 'username 必须以小写字母开头，并使用 4–24 位小写字母、数字或下划线',
    }
  }
  if (displayName.length < 2 || displayName.length > 20) {
    return { ok: false, message: 'displayName 必须是 2–20 个字符' }
  }
  if (
    password.length < 8 ||
    password.length > 64 ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return {
      ok: false,
      message: 'password 必须是 8–64 位，并同时包含字母和数字',
    }
  }
  if (
    typeof role !== 'string' ||
    !PUBLIC_REGISTRATION_ROLES.includes(
      role as (typeof PUBLIC_REGISTRATION_ROLES)[number],
    )
  ) {
    return { ok: false, message: 'role 只支持 PARENT 或 STUDENT' }
  }

  return {
    ok: true,
    value: {
      username,
      displayName,
      password,
      role: role as RegisterRequest['role'],
    },
  }
}
