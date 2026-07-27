import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

import { requestHandler } from './app.js'

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) {
  loadEnvFile(envFile)
}

const host = process.env.API_HOST ?? '127.0.0.1'
const port = Number(process.env.API_PORT ?? 3000)

if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error('API_PORT 必须是 1 到 65535 之间的整数')
}

const server = createServer(requestHandler)

server.listen(port, host, () => {
  console.log(`K12 API 已启动：http://${host}:${port}`)
  console.log(`健康检查：http://${host}:${port}/health`)
})
