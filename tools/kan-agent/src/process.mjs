import { spawn } from 'node:child_process'

export function runCommand(command, args = [], options = {}) {
  const {
    cwd,
    env = process.env,
    inherit = false,
    input,
    allowFailure = false,
    onOutput,
  } = options

  return new Promise((resolve, reject) => {
    const pipeOutput = !inherit || Boolean(onOutput)
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: pipeOutput ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
    })

    let stdout = ''
    let stderr = ''

    if (pipeOutput) {
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString()
        stdout += text
        if (inherit) process.stdout.write(text)
        onOutput?.({ stream: 'stdout', text })
      })
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString()
        stderr += text
        if (inherit) process.stderr.write(text)
        onOutput?.({ stream: 'stderr', text })
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
