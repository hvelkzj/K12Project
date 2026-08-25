import { createServer } from 'node:http'
import { performance } from 'node:perf_hooks'

import { createRequestHandler } from '../apps/api/dist/app.js'
import { createAuthService } from '../apps/api/dist/authService.js'
import { createBusinessStore } from '../apps/api/dist/businessStore.js'

const totalRequests = 500
const concurrency = 50
const password = 'K12Demo123!'

const scenarios = [
  { username: 'parent_201', endpoint: '/parent/students/101/overview' },
  { username: 'student_101', endpoint: '/student/overview' },
  { username: 'teacher_301', endpoint: '/teacher/overview' },
  { username: 'teacher_302', endpoint: '/teacher/overview' },
  { username: 'academic_901', endpoint: '/admin/overview' },
  { username: 'system_999', endpoint: '/admin/overview' },
]

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('无法读取测试端口')
  return `http://127.0.0.1:${address.port}`
}

async function login(baseUrl, username) {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) throw new Error(`${username} 登录失败：HTTP ${response.status}`)
  const body = await response.json()
  return body.accessToken
}

async function verifyRoleIsolation(baseUrl, authorized) {
  const probes = [
    ['parent_201', '/student/overview'],
    ['student_101', '/teacher/overview'],
    ['teacher_301', '/admin/overview'],
    ['academic_901', '/parent/students/101/overview'],
  ]
  for (const [username, endpoint] of probes) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: { Authorization: `Bearer ${authorized.get(username)}` },
    })
    if (response.status !== 403) {
      throw new Error(`${username} 越权探针预期 403，实际 ${response.status}`)
    }
  }
}

async function main() {
  const authService = createAuthService()
  const businessStore = createBusinessStore()
  const server = createServer(createRequestHandler(authService, businessStore))
  const baseUrl = await listen(server)

  try {
    const authorized = new Map()
    for (const scenario of scenarios) {
      authorized.set(scenario.username, await login(baseUrl, scenario.username))
    }
    await verifyRoleIsolation(baseUrl, authorized)

    const latencies = []
    let failures = 0
    let cursor = 0
    const startedAt = performance.now()

    async function worker() {
      while (cursor < totalRequests) {
        const index = cursor
        cursor += 1
        const scenario = scenarios[index % scenarios.length]
        const requestStartedAt = performance.now()
        try {
          const response = await fetch(`${baseUrl}${scenario.endpoint}`, {
            headers: {
              Authorization: `Bearer ${authorized.get(scenario.username)}`,
            },
          })
          if (!response.ok) failures += 1
          await response.arrayBuffer()
        } catch {
          failures += 1
        } finally {
          latencies.push(performance.now() - requestStartedAt)
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))
    const elapsedMs = performance.now() - startedAt
    const sorted = [...latencies].sort((left, right) => left - right)
    const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    const metrics = {
      requests: totalRequests,
      concurrency,
      throughputPerSecond: Number((totalRequests / (elapsedMs / 1000)).toFixed(2)),
      averageMs: Number(average.toFixed(2)),
      p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
      p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
      maximumMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
      failures,
      roleIsolationProbes: 4,
    }
    console.log(JSON.stringify(metrics, null, 2))
    if (failures > 0) throw new Error(`压力测试出现 ${failures} 次失败`)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

await main()
