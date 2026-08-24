import { spawn } from 'node:child_process'

const workspaces = [
  '@k12/api',
  '@k12/portal-web',
  '@k12/parent-web',
  '@k12/student-web',
  '@k12/teacher-web',
  '@k12/admin-web',
]

const children = workspaces.map((workspace) => {
  const args = ['run', 'dev', '--workspace', workspace]
  if (workspace !== '@k12/api') {
    args.push('--', '--host', '127.0.0.1')
  }

  const child = spawn('npm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code
    }
  })

  return child
})

const stop = () => {
  for (const child of children) {
    child.kill('SIGTERM')
  }
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
