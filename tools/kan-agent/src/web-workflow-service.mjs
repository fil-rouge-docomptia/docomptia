import { loadConfig } from './config.mjs'
import { CodexService } from './codex-service.mjs'
import { EventBus } from './event-bus.mjs'
import { GitService } from './git-service.mjs'
import { JiraClient } from './jira-client.mjs'
import { StateStore } from './state-store.mjs'
import {
  buildAutomaticTestFixInstruction,
  hasFailedTests,
  MAX_AUTOMATIC_TEST_FIX_ATTEMPTS,
} from './workflow-service.mjs'

const TERMINAL_STATUSES = ['JIRA_UPDATED', 'ABORTED']
const REVISION_STATUSES = ['IN_PROGRESS', 'REVIEW_REQUIRED', 'APPROVED', 'BLOCKED']

function formatTests(tests = []) {
  return tests.length === 0
    ? 'No test result reported'
    : tests
      .map((test) => `- ${test.status}: ${test.command}\n  ${test.details}`)
      .join('\n')
}

function jiraComment(state, review) {
  return [
    `Implementation pushed for ${state.issue.key}.`,
    '',
    `Branch: ${state.branch}`,
    '',
    'Commits:',
    ...review.commits.map((commit) => `- ${commit}`),
    '',
    'Tests:',
    formatTests(state.agentResult?.tests),
    '',
    'The ticket remains pending human code review.',
  ].join('\n')
}

function diagnostic(name, result) {
  return result.status === 'fulfilled'
    ? { name, status: 'ready', details: result.value }
    : { name, status: 'error', details: result.reason.message }
}

export class WebWorkflowService {
  constructor() {
    this.events = new EventBus()
    this.contextPromise = null
    this.busy = false
  }

  async context() {
    if (!this.contextPromise) {
      this.contextPromise = loadConfig().then((config) => ({
        config,
        codex: new CodexService(config),
        git: new GitService(config),
        jira: new JiraClient(config),
        store: new StateStore(config.state.directory),
      }))
    }
    return this.contextPromise
  }

  publish(event) {
    return this.events.publish(event)
  }

  async saveWithEvent(context, state, event) {
    const published = this.publish({ runId: state.runId, ...event })
    return context.store.save({
      ...state,
      timeline: [...(state.timeline || []), published],
    })
  }

  async requireState() {
    const context = await this.context()
    const state = await context.store.load()
    if (!state) throw new Error('No active ticket')
    return { context, state }
  }

  ensureAvailable(action) {
    if (this.busy) {
      throw new Error(`The agent is already running. Cannot ${action} now.`)
    }
  }

  async doctor() {
    let context
    try {
      context = await this.context()
    } catch (error) {
      return {
        ready: false,
        checks: [
          { name: 'Node', status: 'ready', details: process.version },
          { name: 'Configuration', status: 'error', details: error.message },
        ],
      }
    }

    const results = await Promise.allSettled([
      context.git.version(),
      context.codex.version().then(({ version, command }) => `${version} (${command})`),
      context.jira.getCurrentUser(),
    ])
    const checks = [
      { name: 'Node', status: 'ready', details: process.version },
      { name: 'Git', ...diagnostic('Git', results[0]) },
      { name: 'Codex', ...diagnostic('Codex', results[1]) },
      { name: 'Jira', ...diagnostic('Jira', results[2]) },
    ]
    return {
      ready: checks.every((check) => check.status === 'ready'),
      project: context.config.jira.projectKey,
      checks,
    }
  }

  async getEpics() {
    return (await this.context()).jira.getEpics()
  }

  async getEpicTasks(epicKey) {
    return (await this.context()).jira.getEpicTasks(epicKey)
  }

  async getIssue(issueKey) {
    return (await this.context()).jira.getIssue(issueKey)
  }

  async getActive() {
    const context = await this.context()
    const state = await context.store.load()
    return state ? { ...state, running: this.busy } : null
  }

  async getHistory() {
    const context = await this.context()
    return context.store.listHistory()
  }

  async getReview() {
    const { context, state } = await this.requireState()
    if (!state.branch) return { state, review: null }
    const review = await context.git.getReview(state.worktree, state.branch)
    return { state, review, tests: state.agentResult?.tests || [] }
  }

  async start(issueKey, epicKey) {
    this.ensureAvailable('start another ticket')
    const context = await this.context()
    const active = await context.store.load()
    if (active && !TERMINAL_STATUSES.includes(active.status)) {
      throw new Error(
        `${active.issue.key} is already active with status ${active.status}`,
      )
    }
    if (active) await context.store.archive(active)

    const issue = await context.jira.getIssue(issueKey)
    const resolvedEpicKey = epicKey || issue.parentKey
    if (!resolvedEpicKey) {
      throw new Error(`No Jira epic is associated with ${issue.key}`)
    }
    const epic = await context.jira.getIssue(resolvedEpicKey)
    const runId = `${issue.key}-${Date.now()}`
    let state = await context.store.save({
      runId,
      status: 'SELECTED',
      epic,
      issue,
      createdAt: new Date().toISOString(),
      timeline: [],
    })
    state = await this.saveWithEvent(context, state, {
      type: 'STATE',
      status: 'SELECTED',
      message: `${issue.key} selected and confirmed`,
    })

    this.busy = true
    void this.prepareAndRun(context, state).finally(() => {
      this.busy = false
      this.publish({
        runId: state.runId,
        type: 'IDLE',
        message: 'Agent execution finished',
      })
    })
    return { ...state, running: true }
  }

  async prepareAndRun(context, state) {
    try {
      state = await this.saveWithEvent(context, state, {
        type: 'STEP',
        message: 'Fetching staging and preparing the ticket branch',
      })
      const worktree = await context.git.prepareWorktree(state.issue)
      state = await this.saveWithEvent(context, {
        ...state,
        ...worktree,
        status: 'PREPARED',
      }, {
        type: 'STATE',
        status: 'PREPARED',
        message: `Branch ${worktree.branch} prepared`,
      })

      state = await this.moveJiraToInProgress(context, state)

      await this.runCodex(context, state)
    } catch (error) {
      await this.blockWorkflow(context, state, error)
    }
  }

  async runCodex(context, state, revisionInstruction = '') {
    let currentState = await this.ensureEpic(context, state)
    let currentRevisionRequest = revisionInstruction
    let automaticRetryCount = currentState.automaticRetryCount || 0

    while (true) {
      currentState = await this.saveWithEvent(context, {
        ...currentState,
        status: 'IN_PROGRESS',
        executionError: null,
        automaticRetryCount,
      }, {
        type: 'STATE',
        status: 'IN_PROGRESS',
        message: currentRevisionRequest
          ? typeof currentRevisionRequest === 'string'
            ? 'Revision started'
            : 'Automatic test-fix retry started'
          : 'Codex implementation started',
      })

      let execution
      try {
        execution = await context.codex.run(currentState, currentRevisionRequest, {
          onOutput: ({ stream, text }) => this.publish({
            runId: currentState.runId,
            type: 'LOG',
            level: stream === 'stderr' ? 'warning' : 'info',
            message: text.slice(-4000),
          }),
        })
      } catch (error) {
        await this.blockWorkflow(context, currentState, error)
        return
      }

      const automaticRevision = execution.result.status === 'completed'
        ? buildAutomaticTestFixInstruction(execution.result.tests)
        : null
      const shouldRetry = automaticRevision && automaticRetryCount < MAX_AUTOMATIC_TEST_FIX_ATTEMPTS

      if (execution.result.status === 'completed' && !automaticRevision) {
        execution.result.commits = await context.git.commitTicketChanges(
          currentState.issue,
          currentState.worktree,
        )
        this.publish({
          runId: currentState.runId,
          type: 'GIT',
          level: 'success',
          message: execution.result.commits.length > 0
            ? `Atomic commits created:\n${execution.result.commits.join('\n')}`
            : 'No new changes required a commit',
        })
      }

      if (shouldRetry) {
        automaticRetryCount += 1
        currentState = await this.saveWithEvent(context, {
          ...currentState,
          status: 'IN_PROGRESS',
          agentResult: execution.result,
          resultFile: execution.outputFile,
          automaticRetryCount,
        }, {
          type: 'STEP',
          level: 'warning',
          message: `Automatic retry ${automaticRetryCount}/${MAX_AUTOMATIC_TEST_FIX_ATTEMPTS} because latest tests still failed`,
        })
        currentRevisionRequest = automaticRevision
        continue
      }

      if (execution.result.status === 'completed' && automaticRevision) {
        const blocker = [
          `Automatic test-fix limit reached after ${automaticRetryCount} retry attempt(s).`,
          'Latest failing tests:',
          ...execution.result.tests
            .filter((test) => test.status === 'failed')
            .map((test) => `- ${test.command}: ${test.details}`),
        ].join('\n')
        execution.result = {
          ...execution.result,
          summary: `${execution.result.summary}\n${blocker}`,
          blocker: execution.result.blocker || blocker,
        }
      }

      const status = execution.result.status === 'completed' && !automaticRevision
        ? 'REVIEW_REQUIRED'
        : 'BLOCKED'
      currentState = await this.saveWithEvent(context, {
        ...currentState,
        status,
        agentResult: execution.result,
        resultFile: execution.outputFile,
        automaticRetryCount,
      }, {
        type: 'STATE',
        status,
        level: status === 'BLOCKED' ? 'warning' : 'success',
        message: execution.result.summary,
      })
      await this.releaseWorktree(context, currentState)
      return currentState
    }
  }

  async blockWorkflow(context, state, error) {
    let current = await context.store.load()
    current = current?.runId === state.runId ? current : state
    current = await this.saveWithEvent(context, {
      ...current,
      status: 'BLOCKED',
      executionError: error.message,
    }, {
      type: 'ERROR',
      status: 'BLOCKED',
      level: 'error',
      message: error.message,
    })
    await this.releaseWorktree(context, current)
  }

  async releaseWorktree(context, state) {
    const result = await context.git.releaseWorktree(state.worktree)
    if (!result.released) {
      return this.saveWithEvent(context, {
        ...state,
        worktreeReleaseWarning: result.reason,
      }, {
        type: 'GIT',
        level: 'warning',
        message: result.reason,
      })
    }
    if (!state.worktree) return state

    return this.saveWithEvent(context, {
      ...state,
      worktree: null,
      releasedWorktree: state.worktree,
      worktreeReleasedAt: new Date().toISOString(),
      worktreeReleaseWarning: null,
    }, {
      type: 'GIT',
      message: 'Temporary worktree released; branch kept in SourceCode',
    })
  }

  async ensureWorktree(context, state) {
    if (await context.git.isWorktreeAvailable(state.worktree)) return state
    const prepared = await context.git.prepareWorktree(state.issue)
    return context.store.save({
      ...state,
      ...prepared,
      releasedWorktree: null,
      worktreeReleaseWarning: null,
    })
  }

  async ensureEpic(context, state) {
    if (state.epic) return state
    if (!state.issue.parentKey) {
      throw new Error(`No Jira epic is associated with ${state.issue.key}`)
    }
    const epic = await context.jira.getIssue(state.issue.parentKey)
    return context.store.save({ ...state, epic })
  }

  async moveJiraToInProgress(context, state) {
    try {
      const transitionName = await context.jira.transitionIssue(
        state.issue.key,
        context.config.jira.inProgressStatus,
      )
      return this.saveWithEvent(context, {
        ...state,
        jiraWarning: null,
      }, {
        type: 'JIRA',
        message: `Jira moved to ${transitionName}`,
      })
    } catch (error) {
      return this.saveWithEvent(context, {
        ...state,
        jiraWarning: error.message,
      }, {
        type: 'JIRA',
        level: 'warning',
        message: error.message,
      })
    }
  }

  async revise(instruction) {
    if (!instruction?.trim()) throw new Error('A revision instruction is required')
    this.ensureAvailable('request a revision')
    const { context, state: active } = await this.requireState()
    if (!REVISION_STATUSES.includes(active.status)) {
      throw new Error(`Cannot request a revision while status is ${active.status}`)
    }

    let state = await this.ensureWorktree(context, active)
    state = await this.moveJiraToInProgress(context, state)
    this.busy = true
    void this.runCodex(context, state, instruction.trim()).finally(() => {
      this.busy = false
      this.publish({
        runId: state.runId,
        type: 'IDLE',
        message: 'Revision execution finished',
      })
    })
    return { ...state, running: true }
  }

  async approve() {
    this.ensureAvailable('approve the ticket')
    const { context, state } = await this.requireState()
    if (state.status !== 'REVIEW_REQUIRED') {
      throw new Error(`Ticket must be in REVIEW_REQUIRED, current status: ${state.status}`)
    }

    const validation = await context.git.validateForApproval(
      state.issue.key,
      state.worktree,
      state.branch,
    )
    if (!validation.valid) {
      throw new Error(`Approval checks failed:\n${validation.problems.join('\n\n')}`)
    }
    if (hasFailedTests(state.agentResult?.tests)) {
      throw new Error('At least one reported test failed')
    }

    return this.saveWithEvent(context, {
      ...state,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
    }, {
      type: 'STATE',
      status: 'APPROVED',
      level: 'success',
      message: 'Implementation approved by the user; no push performed',
    })
  }

  async push() {
    this.ensureAvailable('push the ticket')
    const { context, state } = await this.requireState()
    if (!['APPROVED', 'PUSHED'].includes(state.status)) {
      throw new Error(`Approve the ticket first. Current status: ${state.status}`)
    }

    this.busy = true
    void this.pushAndUpdateJira(context, state).finally(() => {
      this.busy = false
      this.publish({
        runId: state.runId,
        type: 'IDLE',
        message: 'Push workflow finished',
      })
    })
    return { ...state, running: true }
  }

  async pushAndUpdateJira(context, state) {
    try {
      const validation = await context.git.validateForApproval(
        state.issue.key,
        state.worktree,
        state.branch,
      )
      if (!validation.valid) {
        throw new Error(`Push checks failed:\n${validation.problems.join('\n\n')}`)
      }

      if (state.status === 'APPROVED') {
        await context.git.push(state.branch, state.worktree)
        state = await this.saveWithEvent(context, {
          ...state,
          status: 'PUSHED',
          pushedAt: new Date().toISOString(),
        }, {
          type: 'STATE',
          status: 'PUSHED',
          level: 'success',
          message: `Branch ${state.branch} pushed`,
        })
      }

      await context.jira.addComment(
        state.issue.key,
        jiraComment(state, validation.review),
      )
      await context.jira.transitionIssue(
        state.issue.key,
        context.config.jira.reviewStatus,
      )
      await this.saveWithEvent(context, {
        ...state,
        status: 'JIRA_UPDATED',
        jiraUpdatedAt: new Date().toISOString(),
      }, {
        type: 'STATE',
        status: 'JIRA_UPDATED',
        level: 'success',
        message: `${state.issue.key} moved to ${context.config.jira.reviewStatus}`,
      })
    } catch (error) {
      await this.saveWithEvent(context, {
        ...state,
        executionError: error.message,
      }, {
        type: 'ERROR',
        level: 'error',
        message: error.message,
      })
    }
  }

  async abort() {
    this.ensureAvailable('abort the ticket')
    const { context, state } = await this.requireState()
    return this.saveWithEvent(context, {
      ...state,
      status: 'ABORTED',
      abortedAt: new Date().toISOString(),
    }, {
      type: 'STATE',
      status: 'ABORTED',
      level: 'warning',
      message: 'Workflow aborted; branch and files were kept',
    })
  }
}
