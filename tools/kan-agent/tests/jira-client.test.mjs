import test from 'node:test'
import assert from 'node:assert/strict'
import { adfToText } from '../src/jira-client.mjs'

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
