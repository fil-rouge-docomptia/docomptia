import test from 'node:test'
import assert from 'node:assert/strict'
import { adfToText, resolveTransition } from '../src/jira-client.mjs'

test('adfToText extracts readable Jira descriptions', () => {
  const document = {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Create the invoice draft.' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Keep the original file.' }],
      },
    ],
  }

  assert.equal(
    adfToText(document),
    'Create the invoice draft.\nKeep the original file.',
  )
})

test('resolveTransition accepts the French Jira equivalent of In Progress', () => {
  const transitions = [
    { id: '1', name: 'A faire' },
    { id: '2', name: 'En cours' },
    { id: '3', name: 'In Review' },
  ]

  assert.deepEqual(resolveTransition(transitions, 'In Progress'), transitions[1])
  assert.deepEqual(resolveTransition(transitions, 'Code Review'), transitions[2])
})
