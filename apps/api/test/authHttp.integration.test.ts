import assert from 'node:assert/strict'
import { createServer, request as createHttpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import test from 'node:test'

import type { ApiError } from '@k12/shared'

import { createRequestHandler } from '../src/app.js'
import { createAuthService } from '../src/authService.js'

interface HttpResult {
  body: string
  status: number
}

function sendChunkedRequest(
  port: number,
  chunks: readonly string[],
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const request = createHttpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      (response) => {
        const responseChunks: Buffer[] = []

        response.on('data', (chunk: Buffer) => responseChunks.push(chunk))
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(responseChunks).toString('utf8'),
          })
        })
      },
    )

    request.on('error', reject)
    for (const chunk of chunks) request.write(chunk)
    request.end()
  })
}

test('真实 HTTP 连接会排空超限请求体并稳定返回 413', async (context) => {
  const handler = createRequestHandler(createAuthService())
  const server = createServer((request, response) => {
    void handler(request, response)
  })

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EPERM' || code === 'EACCES') {
      context.skip('当前执行环境禁止监听本机回环端口')
      return
    }

    throw error
  }

  try {
    const address = server.address() as AddressInfo
    const response = await sendChunkedRequest(address.port, [
      'x'.repeat(8 * 1024),
      'x'.repeat(9 * 1024),
    ])

    assert.equal(response.status, 413)
    assert.equal(
      (JSON.parse(response.body) as ApiError).code,
      'PAYLOAD_TOO_LARGE',
    )
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})
