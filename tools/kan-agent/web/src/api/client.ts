import type {
  DoctorResult,
  Issue,
  ReviewResponse,
  WorkflowState,
} from '../types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Agent request failed')
  return body
}

export const agentApi = {
  doctor: () => request<DoctorResult>('/api/doctor'),
  epics: () => request<Issue[]>('/api/epics'),
  tickets: (epicKey: string) =>
    request<Issue[]>(`/api/epics/${encodeURIComponent(epicKey)}/tickets`),
  ticket: (issueKey: string) =>
    request<Issue>(`/api/tickets/${encodeURIComponent(issueKey)}`),
  active: () => request<WorkflowState | null>('/api/workflows/active'),
  history: () => request<WorkflowState[]>('/api/workflows/history'),
  review: () => request<ReviewResponse>('/api/workflows/review'),
  start: (issueKey: string, epicKey: string) => request<WorkflowState>('/api/workflows', {
    method: 'POST',
    body: JSON.stringify({ issueKey, epicKey }),
  }),
  revise: (instruction: string) => request<WorkflowState>('/api/workflows/revise', {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  }),
  approve: () => request<WorkflowState>('/api/workflows/approve', { method: 'POST' }),
  push: () => request<WorkflowState>('/api/workflows/push', { method: 'POST' }),
  abort: () => request<WorkflowState>('/api/workflows/abort', { method: 'POST' }),
}
