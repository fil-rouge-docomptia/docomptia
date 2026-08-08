import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasFailedTests,
  latestTestsByCommand,
} from '../src/workflow-service.mjs'

test('the latest result decides whether a repeated test command failed', () => {
  const tests = [
    { command: './mvnw test', status: 'failed', details: 'Initial failure' },
    { command: './mvnw -Dtest=InvoiceTest test', status: 'passed', details: 'Focused pass' },
    { command: './mvnw test', status: 'passed', details: 'Final pass' },
  ]

  const latestTests = latestTestsByCommand(tests)

  assert.equal(latestTests.length, 2)
  assert.deepEqual(latestTests[0], {
    command: './mvnw test',
    status: 'passed',
    details: 'Final pass',
  })
  assert.equal(hasFailedTests(tests), false)
})

test('a latest failed test result remains blocking', () => {
  const tests = [
    { command: './mvnw test', status: 'passed', details: 'Initial pass' },
    { command: './mvnw test', status: 'failed', details: 'Final failure' },
  ]

  assert.equal(hasFailedTests(tests), true)
})

test('a command that could not execute tests does not block successful results', () => {
  const tests = [
    { command: './mvnw test', status: 'not_run', details: 'Dependency setup failed' },
    { command: 'junit fallback', status: 'passed', details: 'All tests passed' },
  ]

  assert.equal(hasFailedTests(tests), false)
})
