import { Readable } from 'node:stream'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

export type TestRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>

export interface TestRequestOptions {
  method: string
  url: string
  jsonBody?: unknown
  rawBody?: string | Uint8Array
  rawChunks?: readonly (string | Uint8Array)[]
  contentType?: string | null
  headers?: IncomingHttpHeaders
}

export interface TestResponseState {
  body: string
  bodyBuffer: Buffer
  headers: Map<string, string | number | readonly string[]>
  status: number
}

export async function callHandler(
  handler: TestRequestHandler,
  options: TestRequestOptions,
): Promise<TestResponseState> {
  const body =
    options.rawBody ??
    (options.jsonBody === undefined
      ? undefined
      : JSON.stringify(options.jsonBody))
  const requestChunks =
    options.rawChunks ?? (body === undefined ? [] : [body])
  const request = Readable.from(requestChunks)
  const headers: IncomingHttpHeaders = {
    ...options.headers,
  }

  if (
    options.contentType !== null &&
    (body !== undefined || options.rawChunks !== undefined)
  ) {
    headers['content-type'] = options.contentType ?? 'application/json'
  }

  Object.assign(request, {
    method: options.method,
    url: options.url,
    headers,
  })

  const state: TestResponseState = {
    body: '',
    bodyBuffer: Buffer.alloc(0),
    headers: new Map(),
    status: 0,
  }
  const response = {
    setHeader(name: string, value: string | number | readonly string[]) {
      state.headers.set(name.toLowerCase(), value)
      return this
    },
    writeHead(status: number) {
      state.status = status
      return this
    },
    end(responseBody?: string | Buffer | Uint8Array) {
      state.bodyBuffer = responseBody
        ? Buffer.from(responseBody)
        : Buffer.alloc(0)
      state.body = state.bodyBuffer.toString()
      return this
    },
  }

  await handler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  )
  return state
}

export function parseJsonBody<T>(state: TestResponseState): T {
  return JSON.parse(state.body) as T
}
