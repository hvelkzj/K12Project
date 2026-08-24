import type { IncomingMessage, ServerResponse } from 'node:http'

import type { ApiError } from '@k12/shared'

const maximumJsonBodyBytes = 16 * 1024
export const maximumFileBodyBytes = 10 * 1024 * 1024

export interface JsonBodyResult {
  ok: true
  value: unknown
}

export interface JsonBodyFailure {
  ok: false
  status: number
  error: ApiError
}

export function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, OPTIONS',
  )
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  )
  response.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Disposition, Content-Length',
  )
}

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.writeHead(status)
  response.end(JSON.stringify(body))
}

export function sendNoContent(
  response: ServerResponse,
  status = 204,
): void {
  response.writeHead(status)
  response.end()
}

export function sendFile(
  response: ServerResponse,
  content: Uint8Array,
  mimeType: string,
  originalName: string,
): void {
  response.setHeader('Content-Type', mimeType)
  response.setHeader('Content-Length', content.byteLength)
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
  )
  response.writeHead(200)
  response.end(Buffer.from(content))
}

export function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  sendJson(response, status, { code, message } satisfies ApiError)
}

export function isJsonRequest(request: IncomingMessage): boolean {
  const contentType = request.headers['content-type']
  return (
    contentType?.split(';', 1)[0]?.trim().toLowerCase() ===
    'application/json'
  )
}

export async function readJsonBody(
  request: IncomingMessage,
): Promise<JsonBodyResult | JsonBodyFailure> {
  const chunks: Buffer[] = []
  let byteLength = 0
  let tooLarge = false

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.byteLength

    if (byteLength > maximumJsonBodyBytes) {
      tooLarge = true
      continue
    }

    chunks.push(buffer)
  }

  if (tooLarge) {
    return {
      ok: false,
      status: 413,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: '请求内容不能超过 16 KiB',
      },
    }
  }

  try {
    return {
      ok: true,
      value: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: {
        code: 'INVALID_JSON',
        message: '请求体必须是有效的 JSON',
      },
    }
  }
}

export async function readFileBody(
  request: IncomingMessage,
): Promise<
  | { ok: true; value: Uint8Array }
  | { ok: false; status: 413; error: ApiError }
> {
  const chunks: Buffer[] = []
  let byteLength = 0
  let tooLarge = false

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    byteLength += buffer.byteLength
    if (byteLength > maximumFileBodyBytes) {
      tooLarge = true
      continue
    }
    chunks.push(buffer)
  }

  if (tooLarge) {
    return {
      ok: false,
      status: 413,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: '单个附件不能超过 10 MB',
      },
    }
  }
  return { ok: true, value: Buffer.concat(chunks) }
}

export function getBearerToken(
  request: IncomingMessage,
): string | null {
  const authorization = request.headers.authorization
  if (!authorization) return null

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization)
  return match?.[1] ?? null
}
