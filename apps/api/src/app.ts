import type { IncomingMessage, ServerResponse } from 'node:http'

export const requestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200)
    response.end(
      JSON.stringify({
        service: 'k12-api',
        status: 'ok',
      }),
    )
    return
  }

  response.writeHead(404)
  response.end(
    JSON.stringify({
      code: 'NOT_FOUND',
      message: '接口不存在',
    }),
  )
}
