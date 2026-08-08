import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { buildPrompt } from '../src/prompt-builder.mjs'

test('buildPrompt falls back to context files from the shared repository', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'kan-agent-prompt-'))
  const toolDirectory = resolve(directory, 'tool')
  const repository = resolve(directory, 'repository')
  const worktree = resolve(directory, 'worktree')

  try {
    await mkdir(resolve(toolDirectory, 'prompts'), { recursive: true })
    await mkdir(resolve(repository, 'docs'), { recursive: true })
    await mkdir(worktree, { recursive: true })
    await writeFile(
      resolve(toolDirectory, 'prompts', 'implement-ticket.md'),
      '{{CONTEXT_FILES}}\n{{ISSUE_KEY}}\n{{EPIC_KEY}}',
    )
    await writeFile(resolve(repository, 'docs', 'context.md'), '# Context\n')

    const prompt = await buildPrompt(
      {
        toolDirectory,
        git: { baseRepositoryPath: repository },
        codex: { contextFiles: ['docs/context.md'] },
      },
      {
        worktree,
        issue: {
          key: 'KAN-68',
          summary: 'Align statuses',
          status: 'To Do',
          description: '',
          acceptanceCriteria: '',
        },
        epic: { key: 'KAN-67', summary: 'Lifecycle' },
      },
    )

    assert.match(prompt, new RegExp(resolve(repository, 'docs', 'context.md')))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('buildPrompt accepts a legacy state without a loaded epic', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'kan-agent-legacy-prompt-'))
  const toolDirectory = resolve(directory, 'tool')
  const worktree = resolve(directory, 'worktree')

  try {
    await mkdir(resolve(toolDirectory, 'prompts'), { recursive: true })
    await mkdir(worktree, { recursive: true })
    await writeFile(
      resolve(toolDirectory, 'prompts', 'implement-ticket.md'),
      '{{ISSUE_KEY}}\n{{EPIC_KEY}}\n{{EPIC_SUMMARY}}',
    )

    const prompt = await buildPrompt(
      {
        toolDirectory,
        git: { baseRepositoryPath: directory },
        codex: { contextFiles: [] },
      },
      {
        worktree,
        issue: {
          key: 'KAN-77',
          parentKey: 'KAN-54',
          summary: 'Normalize errors',
          status: 'To Do',
          description: '',
          acceptanceCriteria: '',
        },
      },
    )

    assert.match(prompt, /KAN-77\nKAN-54\nNot provided/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
