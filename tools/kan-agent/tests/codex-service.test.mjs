import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { CodexService } from '../src/codex-service.mjs'
import { runCommand } from '../src/process.mjs'

test('the Codex Git guard blocks pushes and allows read commands', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'kan-agent-'))
  try {
    const service = new CodexService({
      state: { directory },
    })
    const guardDirectory = await service.createGitGuard()
    const git = resolve(guardDirectory, 'git')

    const version = await runCommand(git, ['--version'])
    const push = await runCommand(git, ['push'], { allowFailure: true })

    assert.match(version.stdout, /^git version/)
    assert.equal(push.code, 97)
    assert.match(push.stderr, /git push is blocked/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
