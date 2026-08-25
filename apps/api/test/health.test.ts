import assert from 'node:assert/strict'
import test from 'node:test'

import type { ApiError } from '@k12/shared'

import { requestHandler } from '../src/app.js'
import { callHandler, parseJsonBody } from './httpTestUtils.js'

test('GET /health 返回服务状态', async () => {
  const response = await callHandler(requestHandler, {
    method: 'GET',
    url: '/health',
  })

  assert.equal(response.status, 200)
  assert.deepEqual(parseJsonBody(response), {
    service: 'k12-api',
    status: 'ok',
  })
})

test('未知接口返回 404', async () => {
  const response = await callHandler(requestHandler, {
    method: 'GET',
    url: '/unknown',
  })

  assert.equal(response.status, 404)
  assert.equal(parseJsonBody<ApiError>(response).code, 'NOT_FOUND')
})
