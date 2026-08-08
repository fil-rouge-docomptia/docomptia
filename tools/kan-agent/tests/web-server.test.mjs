import test from 'node:test'
import assert from 'node:assert/strict'
import { createAgentRequestHandler } from '../src/web-server.mjs'

test('web server exposes a local health endpoint without loading configuration', async (t) => {
  const handler = createAgentRequestHandler({})
  let status
  let body
  const response = {
    writeHead(nextStatus) {
      status = nextStatus
    },
    end(content) {
      body = JSON.parse(content)
    },
  }

  await handler({ method: 'GET', url: '/api/health' }, response)

  assert.equal(status, 200)
  assert.deepEqual(body, { status: 'ok' })
})
