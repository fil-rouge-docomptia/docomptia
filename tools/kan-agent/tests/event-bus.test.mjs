import test from 'node:test'
import assert from 'node:assert/strict'
import { EventBus } from '../src/event-bus.mjs'

test('event bus publishes events to subscribers and keeps a bounded history', () => {
  const bus = new EventBus(2)
  const received = []
  const unsubscribe = bus.subscribe((event) => received.push(event))

  bus.publish({ runId: 'KAN-1', type: 'STATE', message: 'selected' })
  bus.publish({ runId: 'KAN-1', type: 'STATE', message: 'prepared' })
  bus.publish({ runId: 'KAN-2', type: 'STATE', message: 'selected' })
  unsubscribe()

  assert.equal(received.length, 3)
  assert.deepEqual(
    bus.getRecentEvents().map(({ message }) => message),
    ['prepared', 'selected'],
  )
  assert.deepEqual(
    bus.getRecentEvents('KAN-1').map(({ message }) => message),
    ['prepared'],
  )
})
