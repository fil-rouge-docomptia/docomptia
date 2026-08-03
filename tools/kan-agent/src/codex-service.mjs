import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { delimiter, resolve } from 'node:path'
import { buildPrompt } from './prompt-builder.mjs'
import { runCommand } from './process.mjs'

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function sanitizedEnvironment() {
  const environment = { ...process.env }
  const secretNames = [
    'JIRA_API_TOKEN',
    'JIRA_EMAIL',
    'JIRA_BASE_URL',
    'GITHUB_TOKEN',
    'GH_TOKEN',
  ]
  secretNames.forEach((name) => delete environment[name])
  return environment
}

export class CodexService {
  constructor(config) {
    this.config = config
  }

  async createGitGuard() {
    const guardDirectory = resolve(this.config.state.directory, 'runtime-bin')
    await mkdir(guardDirectory, { recursive: true })

    const whichGit = await runCommand('which', ['git'])
    const guardPath = resolve(guardDirectory, 'git')
    const script = `#!/bin/sh
for argument in "$@"; do
  if [ "$argument" = "push" ]; then
    echo "git push is blocked inside Codex. Use kan-agent approve then kan-agent push." >&2
    exit 97
  fi
done
exec ${shellQuote(whichGit.stdout)} "$@"
`
    await writeFile(guardPath, script, 'utf8')
    await chmod(guardPath, 0o755)
    return guardDirectory
  }

  async resolveCommand() {
    const configuredCommand = this.config.codex.command
    const candidates = [
      process.env.OPENAI_CODEX_BIN,
      configuredCommand !== 'auto' ? configuredCommand : null,
      '/Applications/ChatGPT.app/Contents/Resources/codex',
      'codex',
    ].filter(Boolean)

    for (const candidate of [...new Set(candidates)]) {
      const version = await runCommand(candidate, ['--version'], { allowFailure: true })
      if (version.code === 0 && `${version.stdout}\n${version.stderr}`.includes('codex-cli')) {
        return candidate
      }
    }

    throw new Error(
      'OpenAI Codex CLI was not found. Install @openai/codex or set OPENAI_CODEX_BIN. ' +
      'The npm package named "codex" is a different tool.',
    )
  }

  async run(state, revisionInstruction = '') {
    const prompt = await buildPrompt(this.config, state, revisionInstruction)
    const runDirectory = resolve(
      this.config.state.directory,
      'runs',
      `${state.issue.key}-${Date.now()}`,
    )
    await mkdir(runDirectory, { recursive: true })

    const outputFile = resolve(runDirectory, 'result.json')
    const schemaFile = resolve(this.config.toolDirectory, 'schemas', 'task-result.json')
    const guardDirectory = await this.createGitGuard()
    const codexCommand = await this.resolveCommand()
    const environment = sanitizedEnvironment()
    environment.PATH = `${guardDirectory}${delimiter}${environment.PATH}`

    const args = [
      '--ask-for-approval',
      this.config.codex.approvalPolicy,
      '--sandbox',
      this.config.codex.sandbox,
      'exec',
      '--cd',
      state.worktree,
      '--output-last-message',
      outputFile,
      '--output-schema',
      schemaFile,
      '-',
    ]

    await runCommand(codexCommand, args, {
      cwd: state.worktree,
      env: environment,
      input: prompt,
      inherit: true,
    })

    let result
    try {
      result = JSON.parse(await readFile(outputFile, 'utf8'))
    } catch (error) {
      throw new Error(`Codex did not return valid structured output: ${error.message}`)
    }
    return { result, outputFile }
  }

  async version() {
    const command = await this.resolveCommand()
    const result = await runCommand(command, ['--version'])
    return { command, version: result.stdout }
  }
}
