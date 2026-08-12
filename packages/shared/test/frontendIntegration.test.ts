import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

interface PackageManifest {
  dependencies?: Record<string, string>
}

const repositoryRoot = new URL('../../../', import.meta.url)
const frontendWorkspaces = [
  'apps/parent-web',
  'apps/student-web',
  'apps/teacher-web',
  'apps/admin-web',
] as const

function readPackageManifest(workspace: string): PackageManifest {
  const contents = readFileSync(
    new URL(`${workspace}/package.json`, repositoryRoot),
    'utf8',
  )
  return JSON.parse(contents) as PackageManifest
}

test('四个前端声明精确的共享包版本', () => {
  for (const workspace of frontendWorkspaces) {
    const manifest = readPackageManifest(workspace)
    assert.equal(
      manifest.dependencies?.['@k12/shared'],
      '0.1.0',
      `${workspace} 必须使用 @k12/shared 0.1.0`,
    )
  }
})

test('四个前端使用统一的 API 地址示例', () => {
  for (const workspace of frontendWorkspaces) {
    const envExample = readFileSync(
      new URL(`${workspace}/.env.example`, repositoryRoot),
      'utf8',
    )
    const variables = envExample.trim().split(/\r?\n/)

    assert.equal(
      variables.includes(
        'VITE_API_BASE_URL=http://127.0.0.1:3000',
      ),
      true,
      `${workspace} 必须提供统一的 VITE_API_BASE_URL`,
    )
  }
})

test('所有工作区只使用根目录锁文件', () => {
  const workspaces = [
    'packages/shared',
    'apps/api',
    ...frontendWorkspaces,
  ]

  for (const workspace of workspaces) {
    assert.equal(
      existsSync(new URL(`${workspace}/package-lock.json`, repositoryRoot)),
      false,
      `${workspace} 不得包含独立 package-lock.json`,
    )
  }

  assert.equal(
    existsSync(new URL('package-lock.json', repositoryRoot)),
    true,
  )
})
