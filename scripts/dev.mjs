import { spawn } from 'node:child_process'

const workspaces = [
  '@k12/api',
  '@k12/parent-web',
  '@k12/student-web',
  '@k12/teacher-web',
  '@k12/admin-web',
]

const children = workspaces.map((workspace) => {
  const child = spawn('npm', ['run', 'dev', '--workspace', workspace], {
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
