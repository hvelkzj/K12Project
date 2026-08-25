import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

interface PackageManifest {
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
}

const repositoryRoot = new URL('../../../', import.meta.url)
const frontendWorkspaces = [
  'apps/portal-web',
  'apps/parent-web',
  'apps/student-web',
  'apps/teacher-web',
  'apps/admin-web',
] as const
const businessFrontendWorkspaces = frontendWorkspaces.filter(
  (workspace) => workspace !== 'apps/portal-web',
)

function readPackageManifest(workspace: string): PackageManifest {
  const contents = readFileSync(
    new URL(`${workspace}/package.json`, repositoryRoot),
    'utf8',
  )
  return JSON.parse(contents) as PackageManifest
}

test('五个前端声明精确的共享包版本', () => {
  for (const workspace of frontendWorkspaces) {
    const manifest = readPackageManifest(workspace)
    assert.equal(
      manifest.dependencies?.['@k12/shared'],
      '0.1.0',
      `${workspace} 必须使用 @k12/shared 0.1.0`,
    )
  }
})

test('五个前端使用统一的 API 地址示例', () => {
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

test('四个业务端登录页使用统一入口地址示例', () => {
  for (const workspace of businessFrontendWorkspaces) {
    const envExample = readFileSync(
      new URL(`${workspace}/.env.example`, repositoryRoot),
      'utf8',
    )

    assert.match(
      envExample,
      /^VITE_PORTAL_URL=http:\/\/127\.0\.0\.1:5172$/m,
      `${workspace} 必须提供统一的 VITE_PORTAL_URL`,
    )
  }
})

test('四个业务端登录页提供返回统一首页入口', () => {
  const loginSources = [
    'apps/parent-web/src/App.ts',
    'apps/student-web/src/views/Login.vue',
    'apps/teacher-web/src/App.vue',
    'apps/admin-web/src/App.vue',
  ]

  for (const sourcePath of loginSources) {
    const source = readFileSync(new URL(sourcePath, repositoryRoot), 'utf8')
    assert.match(source, /VITE_PORTAL_URL/)
    assert.match(source, /返回统一首页/)
  }
})

test('统一首页面向家校用户介绍平台', () => {
  const portalSource = readFileSync(
    new URL('apps/portal-web/src/App.vue', repositoryRoot),
    'utf8',
  )
  const template = portalSource.split('<template>')[1] ?? ''

  assert.doesNotMatch(
    template,
    /\bAPI\b|\bMock\b|访问令牌|状态码|运行时账号仓库/,
  )
  assert.match(template, /家长、学生、教师与学校管理人员/)
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

test('根目录五个前端启动命令统一监听回环地址', () => {
  const rootManifest = readPackageManifest('.')
  for (const scriptName of [
    'dev:portal',
    'dev:parent',
    'dev:student',
    'dev:teacher',
    'dev:admin',
  ]) {
    assert.match(
      rootManifest.scripts?.[scriptName] ?? '',
      /--host 127\.0\.0\.1$/,
      `${scriptName} 必须与文档地址一致`,
    )
  }

  const unifiedDevScript = readFileSync(
    new URL('scripts/dev.mjs', repositoryRoot),
    'utf8',
  )
  assert.match(
    unifiedDevScript,
    /args\.push\('--', '--host', '127\.0\.0\.1'\)/,
  )
})

test('统一启动通过 Node 调用当前 npm CLI 且不启用 shell', () => {
  const unifiedDevScript = readFileSync(
    new URL('scripts/dev.mjs', repositoryRoot),
    'utf8',
  )

  assert.match(
    unifiedDevScript,
    /const npmCli = process\.env\.npm_execpath/,
  )
  assert.match(unifiedDevScript, /Run the project with npm run dev/)
  assert.match(unifiedDevScript, /spawn\(process\.execPath, \[npmCli, \.\.\.args\],/)
  assert.doesNotMatch(unifiedDevScript, /\bshell\s*:/)
})

test('公共 npm 脚本不使用单系统命令或本机绝对路径', () => {
  const manifests = [
    readPackageManifest('.'),
    readPackageManifest('packages/shared'),
    readPackageManifest('apps/api'),
    ...frontendWorkspaces.map(readPackageManifest),
  ]
  const forbidden = /(?:^|\s)(?:cp|rm|export|set)(?:\s|$)|\/Users\/|[A-Za-z]:\\/

  for (const manifest of manifests) {
    for (const command of Object.values(manifest.scripts ?? {})) {
      assert.doesNotMatch(command, forbidden)
    }
  }
})
