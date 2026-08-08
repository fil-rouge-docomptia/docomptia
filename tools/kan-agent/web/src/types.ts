export type Issue = {
  id: string
  key: string
  summary: string
  description: string
  acceptanceCriteria: string
  status: string
  issueType: string
  parentKey: string
}

export type WorkflowEvent = {
  id: string
  runId?: string
  createdAt: string
  type: string
  level: 'info' | 'success' | 'warning' | 'error'
  status?: string
  message: string
}

export type TestResult = {
  command: string
  status: 'passed' | 'failed'
  details: string
}

export type WorkflowState = {
  runId: string
  status: string
  issue: Issue
  branch?: string
  worktree?: string | null
  running?: boolean
  createdAt: string
  updatedAt: string
  timeline?: WorkflowEvent[]
  executionError?: string
  jiraWarning?: string
  agentResult?: {
    status: string
    summary: string
    tests: TestResult[]
    blocker?: string
  }
}

export type Review = {
  commits: string[]
  files: string[]
  diffStat: string
  blockingStatus: string
  ignoredStatus: string
}

export type ReviewResponse = {
  state: WorkflowState
  review: Review | null
  tests?: TestResult[]
}

export type DoctorResult = {
  ready: boolean
  project?: string
  checks: Array<{
    name: string
    status: 'ready' | 'error'
    details: string
  }>
}
