import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

test('Codex receives a writable copy of the persistent Maven cache', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'kan-agent-maven-test-'))
  const source = resolve(directory, 'persistent-cache')
  const issueKey = `KAN-${Date.now()}`
  const previousSource = process.env.KAN_AGENT_MAVEN_CACHE_SOURCE
  let target

  try {
    await mkdir(resolve(source, 'repository'), { recursive: true })
    await writeFile(resolve(source, 'repository', 'marker.txt'), 'cached\n', 'utf8')
    process.env.KAN_AGENT_MAVEN_CACHE_SOURCE = source

    const service = new CodexService({ state: { directory } })
    const environment = {}
    target = await service.prepareMavenEnvironment({ issue: { key: issueKey } }, environment)

    assert.equal(environment.MAVEN_USER_HOME, target)
    assert.equal(
      environment.MAVEN_OPTS,
      `-Dmaven.repo.local=${resolve(target, 'repository')}`,
    )
    assert.equal(
      await readFile(resolve(target, 'repository', 'marker.txt'), 'utf8'),
      'cached\n',
    )
  } finally {
    if (previousSource === undefined) delete process.env.KAN_AGENT_MAVEN_CACHE_SOURCE
    else process.env.KAN_AGENT_MAVEN_CACHE_SOURCE = previousSource
    if (target) await rm(target, { recursive: true, force: true })
    await rm(directory, { recursive: true, force: true })
  }
})
