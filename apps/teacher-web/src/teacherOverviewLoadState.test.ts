import assert from 'node:assert/strict'
import test from 'node:test'

import { TeacherBusinessError } from './teacherBusinessClient'
import { resolveTeacherOverviewLoadFailure } from './teacherOverviewLoadState'

test('401 概览错误清理会话并返回登录页', () => {
  assert.deepEqual(
    resolveTeacherOverviewLoadFailure(
      new TeacherBusinessError('请重新登录', 401, 'INVALID_SESSION'),
    ),
    {
      sessionExpired: true,
      authMessage: '登录已失效，请重新登录',
      overviewLoadError: '',
      notice: '',
    },
  )
})

for (const scenario of [
  { status: 403, code: 'FORBIDDEN', message: '只能查看负责班级' },
  { status: 409, code: 'CONFLICT', message: '数据状态已变更' },
  {
    status: 0,
    code: 'NETWORK_ERROR',
    message: '网络请求失败，请稍后重试',
  },
]) {
  test(`${scenario.status} 概览错误同时提供失败面板和通知文案`, () => {
    assert.deepEqual(
      resolveTeacherOverviewLoadFailure(
        new TeacherBusinessError(
          scenario.message,
          scenario.status,
          scenario.code,
        ),
      ),
      {
        sessionExpired: false,
        authMessage: '',
        overviewLoadError: scenario.message,
        notice: scenario.message,
      },
    )
  })
}

test('未知概览错误使用稳定中文回退', () => {
  assert.deepEqual(resolveTeacherOverviewLoadFailure(null), {
    sessionExpired: false,
    authMessage: '',
    overviewLoadError: '教师数据加载失败',
    notice: '教师数据加载失败',
  })
})
