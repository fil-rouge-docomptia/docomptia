import { spawn } from 'node:child_process'

export function runCommand(command, args = [], options = {}) {
  const {
    cwd,
    env = process.env,
    inherit = false,
    input,
    allowFailure = false,
  } = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: inherit ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    if (!inherit) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
    }

    child.on('error', reject)
    child.on('close', (code) => {
      const result = { code, stdout: stdout.trim(), stderr: stderr.trim() }
      if (code === 0 || allowFailure) {
        resolve(result)
        return
      }

      const details = stderr.trim() || stdout.trim() || `exit code ${code}`
      reject(new Error(`${command} ${args.join(' ')} failed: ${details}`))
    })

    if (input !== undefined) {
      child.stdin.write(input)
    }
    child.stdin.end()
  })
}
