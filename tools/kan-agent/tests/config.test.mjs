import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../src/config.mjs'

test('loadConfig reads local environment without overriding exported variables', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kan-agent-config-'))
  const configPath = join(directory, 'config.json')
  const environmentPath = join(directory, '.env.local')
  const previousEnvironment = {
    KAN_AGENT_CONFIG: process.env.KAN_AGENT_CONFIG,
    KAN_AGENT_ENV_FILE: process.env.KAN_AGENT_ENV_FILE,
    JIRA_BASE_URL: process.env.JIRA_BASE_URL,
    JIRA_EMAIL: process.env.JIRA_EMAIL,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
  }

  try {
    await writeFile(configPath, JSON.stringify({
      jira: { baseUrl: '', projectKey: 'KAN' },
      git: {
        repositoryUrl: 'https://example.com/repository.git',
        baseRepositoryPath: '~/base',
        worktreesDirectory: '~/worktrees',
      },
      state: { directory: '~/state' },
    }))
    await writeFile(
      environmentPath,
      [
        'JIRA_BASE_URL=https://example.atlassian.net',
        'JIRA_EMAIL="user@example.com"',
        'JIRA_API_TOKEN=file-token',
      ].join('\n'),
    )

    process.env.KAN_AGENT_CONFIG = configPath
    process.env.KAN_AGENT_ENV_FILE = environmentPath
    delete process.env.JIRA_BASE_URL
    delete process.env.JIRA_EMAIL
    process.env.JIRA_API_TOKEN = 'exported-token'

    const config = await loadConfig()

    assert.equal(config.jira.baseUrl, 'https://example.atlassian.net')
    assert.equal(config.jira.email, 'user@example.com')
    assert.equal(config.jira.apiToken, 'exported-token')
  } finally {
    Object.entries(previousEnvironment).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
    await rm(directory, { recursive: true, force: true })
  }
})
