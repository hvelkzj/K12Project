import assert from 'node:assert/strict'
import type { IncomingMessage, ServerResponse } from 'node:http'
import test from 'node:test'

import { requestHandler } from '../src/app.js'

const request = (method: string, url: string) =>
  ({ method, url }) as IncomingMessage

const response = () => {
  const state = {
    body: '',
    headers: new Map<string, string>(),
    status: 0,
  }

  const value = {
    setHeader(name: string, headerValue: string) {
      state.headers.set(name, headerValue)
    },
    writeHead(status: number) {
      state.status = status
    },
    end(body: string) {
      state.body = body
    },
  }

  return {
    state,
    value: value as unknown as ServerResponse,
  }
}

test('GET /health 返回服务状态', () => {
  const result = response()
  requestHandler(request('GET', '/health'), result.value)

  assert.equal(result.state.status, 200)
  assert.deepEqual(JSON.parse(result.state.body), {
    service: 'k12-api',
    status: 'ok',
  })
})

test('未知接口返回 404', () => {
  const result = response()
  requestHandler(request('GET', '/unknown'), result.value)

  assert.equal(result.state.status, 404)
})
