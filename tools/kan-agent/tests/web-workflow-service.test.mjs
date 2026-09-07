import test from 'node:test'
import assert from 'node:assert/strict'
import { WebWorkflowService } from '../src/web-workflow-service.mjs'

class TestWebWorkflowService extends WebWorkflowService {
  constructor() {
    super()
    this.events = []
  }

  publish(event) {
    this.events.push(event)
    return event
  }

  async saveWithEvent(_context, state, event) {
    this.events.push(event)
    return {
      ...state,
      ...(event.status ? { status: event.status } : {}),
      timeline: [...(state.timeline || []), event],
    }
  }

  async ensureEpic(_context, state) {
    return state
  }

  async releaseWorktree(_context, state) {
    return state
  }
}

test('web workflow retries automatically when completed runs still report failed tests', async () => {
  const service = new TestWebWorkflowService()
  const revisionRequests = []
  const context = {
    codex: {
      async run(_state, revisionRequest) {
        revisionRequests.push(revisionRequest)
        if (revisionRequests.length === 1) {
          return {
            result: {
              status: 'completed',
              summary: 'First implementation still fails tests',
              filesChanged: ['backend/src/main/java/org/example/Foo.java'],
              tests: [
                {
                  command: 'cd backend && ./mvnw test',
                  status: 'failed',
                  details: 'UserServiceImplTest failed before assertions',
                },
              ],
              commits: [],
              blocker: null,
            },
            outputFile: '/tmp/result-1.json',
          }
        }

        return {
          result: {
            status: 'completed',
            summary: 'Second implementation is green',
            filesChanged: ['backend/src/main/java/org/example/Foo.java'],
            tests: [
              {
                command: 'cd backend && ./mvnw test',
                status: 'passed',
                details: '192 tests run; all passed',
              },
            ],
            commits: [],
            blocker: null,
          },
          outputFile: '/tmp/result-2.json',
        }
      },
    },
    git: {
      async commitTicketChanges() {
        return ['abc123 KAN-161: Fix failing tests']
      },
    },
  }
  const state = {
    runId: 'KAN-161-1',
    issue: { key: 'KAN-161' },
    worktree: '/tmp/kan-161',
    timeline: [],
  }

  const finalState = await service.runCodex(context, state)

  assert.equal(revisionRequests.length, 2)
  assert.equal(revisionRequests[0], '')
  assert.equal(revisionRequests[1].source, 'agent')
  assert.match(revisionRequests[1].message, /UserServiceImplTest failed before assertions/)
  assert.equal(finalState.status, 'REVIEW_REQUIRED')
  assert.deepEqual(finalState.agentResult.commits, ['abc123 KAN-161: Fix failing tests'])
  assert.equal(
    service.events.some((event) =>
      event.message?.includes('Automatic retry 1/1 because latest tests still failed')),
    true,
  )
})
