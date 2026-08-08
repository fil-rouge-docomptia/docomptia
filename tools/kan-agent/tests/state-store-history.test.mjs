import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { StateStore } from '../src/state-store.mjs'

test('state store returns archived workflows from newest to oldest', async (t) => {
  const directory = await mkdtemp(resolve(tmpdir(), 'kan-agent-state-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const store = new StateStore(directory)

  await store.archive({
    issue: { key: 'KAN-1' },
    status: 'JIRA_UPDATED',
    updatedAt: '2026-01-01T10:00:00.000Z',
  })
  await store.archive({
    issue: { key: 'KAN-2' },
    status: 'ABORTED',
    updatedAt: '2026-01-02T10:00:00.000Z',
  })

  const history = await store.listHistory()

  assert.deepEqual(history.map(({ issue }) => issue.key), ['KAN-2', 'KAN-1'])
})
