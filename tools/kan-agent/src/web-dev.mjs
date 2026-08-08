import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const toolDirectory = resolve(sourceDirectory, '..')
const viteBinary = resolve(
  toolDirectory,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vite.cmd' : 'vite',
)

const processes = [
  spawn(process.execPath, ['--watch', resolve(sourceDirectory, 'web-server.mjs')], {
    cwd: toolDirectory,
    stdio: 'inherit',
  }),
  spawn(viteBinary, ['--config', resolve(toolDirectory, 'web', 'vite.config.js')], {
    cwd: toolDirectory,
    stdio: 'inherit',
  }),
]

function stop() {
  processes.forEach((child) => child.kill('SIGTERM'))
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

processes.forEach((child) => {
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code
  })
})
