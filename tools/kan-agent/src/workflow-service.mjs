import { loadConfig, initializeConfig } from './config.mjs'
import { CodexService } from './codex-service.mjs'
import { GitService } from './git-service.mjs'
import { JiraClient } from './jira-client.mjs'
import { StateStore } from './state-store.mjs'
import { confirm, printSection, selectItem } from './terminal.mjs'

async function services() {
  const config = await loadConfig()
  return {
    config,
    codex: new CodexService(config),
    git: new GitService(config),
    jira: new JiraClient(config),
    store: new StateStore(config.state.directory),
  }
}

function formatTests(tests = []) {
  return tests.length === 0
    ? 'No test result reported'
    : tests
      .map((test) => `- ${test.status}: ${test.command}\n  ${test.details}`)
      .join('\n')
}

function formatReview(review) {
  return [
    `Commits:\n${review.commits.join('\n') || 'None'}`,
    `\nChanged files:\n${review.files.join('\n') || 'None'}`,
    `\nDiff summary:\n${review.diffStat || 'No diff'}`,
    `\nWorking tree:\n${review.status || 'Clean'}`,
  ].join('\n')
}

async function requireState(store) {
  const state = await store.load()
  if (!state) {
    throw new Error('No active ticket. Run: kan-agent start')
  }
  return state
}

async function tryJiraTransition(jira, issueKey, status) {
  try {
    await jira.transitionIssue(issueKey, status)
    return null
  } catch (error) {
    console.warn(`Jira warning: ${error.message}`)
    return error.message
  }
}

async function runCodexAndSave(context, state, revisionInstruction = '') {
  state = await context.store.save({ ...state, status: 'IN_PROGRESS' })
  try {
    const execution = await context.codex.run(state, revisionInstruction)
    const nextStatus = execution.result.status === 'completed'
      ? 'REVIEW_REQUIRED'
      : 'BLOCKED'
    state = await context.store.save({
      ...state,
      status: nextStatus,
      agentResult: execution.result,
      resultFile: execution.outputFile,
    })
  } catch (error) {
    state = await context.store.save({
      ...state,
      status: 'BLOCKED',
      executionError: error.message,
    })
    throw error
  }

  printSection('Agent result', state.agentResult.summary)
  printSection('Tests', formatTests(state.agentResult.tests))
  if (state.agentResult.blocker) {
    printSection('Blocker', state.agentResult.blocker)
  }
  console.log(`\nState: ${state.status}`)
  console.log('No push was performed.')
  return state
}

export async function initAgent() {
  const result = await initializeConfig()
  if (result.created) {
    console.log(`Configuration created: ${result.path}`)
    console.log('Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN before starting.')
  } else {
    console.log(`Configuration already exists: ${result.path}`)
  }
  if (result.environmentCreated) {
    console.log(`Environment file created: ${result.environmentPath}`)
    console.log('Set JIRA_BASE_URL, JIRA_EMAIL and JIRA_API_TOKEN in this file.')
  } else {
    console.log(`Environment file already exists: ${result.environmentPath}`)
  }
}

export async function doctorAgent() {
  const context = await services()
  const nodeVersion = process.version
  const gitVersion = await context.git.version()
  const codex = await context.codex.version()
  const jiraUser = await context.jira.getCurrentUser()

  printSection(
    'KAN Agent diagnostics',
    [
      `Node: ${nodeVersion}`,
      `Git: ${gitVersion}`,
      `Codex: ${codex.version}`,
      `Codex binary: ${codex.command}`,
      `Jira user: ${jiraUser}`,
      `Jira project: ${context.config.jira.projectKey}`,
      'Status: ready',
    ].join('\n'),
  )
}

export async function startTask() {
  const context = await services()
  const active = await context.store.load()
  if (active && !['JIRA_UPDATED', 'ABORTED'].includes(active.status)) {
    throw new Error(
      `Ticket ${active.issue.key} is already active with status ${active.status}. ` +
      'Use status, review, revise, approve, push, or abort.',
    )
  }
  if (active) {
    await context.store.archive(active)
  }

  console.log('Loading Jira epics...')
  const epic = await selectItem(
    'Choose an epic',
    await context.jira.getEpics(),
    (item) => `${item.key} - ${item.summary}`,
  )
  const issue = await selectItem(
    `Choose a ticket from ${epic.key}`,
    await context.jira.getEpicTasks(epic.key),
    (item) => `${item.key} - ${item.summary} [${item.status}]`,
  )
  const detailedIssue = await context.jira.getIssue(issue.key)

  printSection('Selected ticket', `${detailedIssue.key} - ${detailedIssue.summary}`)
  console.log(detailedIssue.description || 'No description')
  if (!await confirm('\nPrepare the branch and start implementation?')) {
    console.log('Cancelled.')
    return
  }

  let state = await context.store.save({
    status: 'SELECTED',
    epic,
    issue: detailedIssue,
    createdAt: new Date().toISOString(),
  })
  const worktree = await context.git.prepareWorktree(detailedIssue)
  state = await context.store.save({
    ...state,
    ...worktree,
    status: 'PREPARED',
  })

  const jiraWarning = await tryJiraTransition(
    context.jira,
    detailedIssue.key,
    context.config.jira.inProgressStatus,
  )
  if (jiraWarning) {
    state = await context.store.save({ ...state, jiraWarning })
  }

  await runCodexAndSave(context, state)
}

export async function showStatus() {
  const context = await services()
  const state = await requireState(context.store)
  printSection(
    'Active ticket',
    `${state.issue.key} - ${state.issue.summary}\nStatus: ${state.status}\nBranch: ${state.branch || 'Not prepared'}\nWorktree: ${state.worktree || 'Not prepared'}`,
  )
  if (state.agentResult) {
    printSection('Agent summary', state.agentResult.summary)
    printSection('Tests', formatTests(state.agentResult.tests))
  }
  if (state.executionError) {
    printSection('Execution error', state.executionError)
  }
}

export async function reviewTask() {
  const context = await services()
  const state = await requireState(context.store)
  if (!state.worktree) {
    throw new Error('The worktree has not been prepared yet')
  }
  const review = await context.git.getReview(state.worktree)
  printSection(`${state.issue.key} review`, formatReview(review))
  if (state.agentResult) {
    printSection('Tests', formatTests(state.agentResult.tests))
  }
}

export async function reviseTask(instruction) {
  if (!instruction?.trim()) {
    throw new Error('Usage: kan-agent revise "requested change"')
  }
  const context = await services()
  const state = await requireState(context.store)
  if (!['REVIEW_REQUIRED', 'APPROVED', 'BLOCKED'].includes(state.status)) {
    throw new Error(`Cannot request a revision while status is ${state.status}`)
  }

  await runCodexAndSave(context, state, instruction.trim())
}

export async function approveTask() {
  const context = await services()
  let state = await requireState(context.store)
  if (state.status !== 'REVIEW_REQUIRED') {
    throw new Error(`Ticket must be in REVIEW_REQUIRED, current status: ${state.status}`)
  }

  const validation = await context.git.validateForApproval(
    state.issue.key,
    state.worktree,
  )
  printSection(`${state.issue.key} review`, formatReview(validation.review))
  printSection('Tests', formatTests(state.agentResult?.tests))
  if (!validation.valid) {
    throw new Error(`Approval checks failed:\n${validation.problems.join('\n\n')}`)
  }
  if (state.agentResult?.tests.some((test) => test.status === 'failed')) {
    throw new Error('At least one reported test failed')
  }
  if (!await confirm('Approve this implementation?', false)) {
    console.log('Approval cancelled.')
    return
  }

  state = await context.store.save({
    ...state,
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
  })
  console.log(`${state.issue.key} approved. No push was performed.`)
  console.log('Run: kan-agent push')
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

export async function pushTask() {
  const context = await services()
  let state = await requireState(context.store)
  if (!['APPROVED', 'PUSHED'].includes(state.status)) {
    throw new Error(`Run kan-agent approve first. Current status: ${state.status}`)
  }

  const validation = await context.git.validateForApproval(
    state.issue.key,
    state.worktree,
  )
  if (!validation.valid) {
    throw new Error(`Push checks failed:\n${validation.problems.join('\n\n')}`)
  }

  if (state.status === 'APPROVED') {
    printSection(`${state.issue.key} final review`, formatReview(validation.review))
    if (!await confirm(`Push branch ${state.branch}?`, false)) {
      console.log('Push cancelled.')
      return
    }
    await context.git.push(state.branch, state.worktree)
    state = await context.store.save({
      ...state,
      status: 'PUSHED',
      pushedAt: new Date().toISOString(),
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
  state = await context.store.save({
    ...state,
    status: 'JIRA_UPDATED',
    jiraUpdatedAt: new Date().toISOString(),
  })
  console.log(`${state.branch} pushed and ${state.issue.key} moved to Code Review.`)
}

export async function abortTask() {
  const context = await services()
  const state = await requireState(context.store)
  if (!await confirm(`Abort ${state.issue.key}? The branch and worktree will be kept.`, false)) {
    console.log('Abort cancelled.')
    return
  }
  await context.store.save({
    ...state,
    status: 'ABORTED',
    abortedAt: new Date().toISOString(),
  })
  console.log('Workflow aborted. No branch or file was deleted.')
}
