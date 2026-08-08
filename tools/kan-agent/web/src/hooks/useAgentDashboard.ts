import { useEffect, useState } from 'react'
import { agentApi } from '../api/client'
import type {
  DoctorResult,
  Issue,
  ReviewResponse,
  WorkflowEvent,
  WorkflowState,
} from '../types'

export function useAgentDashboard() {
  const [doctor, setDoctor] = useState<DoctorResult | null>(null)
  const [epics, setEpics] = useState<Issue[]>([])
  const [tickets, setTickets] = useState<Issue[]>([])
  const [active, setActive] = useState<WorkflowState | null>(null)
  const [history, setHistory] = useState<WorkflowState[]>([])
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [events, setEvents] = useState<WorkflowEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  async function refreshWorkflow() {
    const current = await agentApi.active()
    setActive(current)
    if (current?.branch) {
      try {
        setReview(await agentApi.review())
      } catch {
        setReview(null)
      }
    } else {
      setReview(null)
    }
  }

  async function refreshDashboardState() {
    const [current, historyResult] = await Promise.all([
      agentApi.active(),
      agentApi.history(),
    ])
    setActive(current)
    setHistory(historyResult)
    if (current?.branch) {
      try {
        setReview(await agentApi.review())
      } catch {
        setReview(null)
      }
    }
  }

  async function initialize() {
    setLoading(true)
    setError('')
    try {
      const [doctorResult, epicResult, activeResult, historyResult] =
        await Promise.allSettled([
          agentApi.doctor(),
          agentApi.epics(),
          agentApi.active(),
          agentApi.history(),
        ])
      if (doctorResult.status === 'fulfilled') setDoctor(doctorResult.value)
      if (epicResult.status === 'fulfilled') setEpics(epicResult.value)
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value)
      if (activeResult.status === 'fulfilled') {
        setActive(activeResult.value)
        setEvents(activeResult.value?.timeline || [])
        if (activeResult.value?.branch) setReview(await agentApi.review())
      }

      const failure = [doctorResult, epicResult, activeResult, historyResult]
        .find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') setError(failure.reason.message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the agent')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void initialize()
  }, [])

  useEffect(() => {
    const stream = new EventSource('/api/events')
    stream.onopen = () => setError((current) =>
      current === 'Live connection interrupted. Reconnecting...' ? '' : current,
    )
    stream.onmessage = (message) => {
      const event = JSON.parse(message.data) as WorkflowEvent
      setEvents((current) => [...current.slice(-199), event])
      if (
        event.type === 'STATE' ||
        event.type === 'ERROR' ||
        event.type === 'GIT' ||
        event.type === 'IDLE'
      ) {
        void refreshDashboardState()
      }
    }
    stream.onerror = () => setError('Live connection interrupted. Reconnecting...')
    return () => stream.close()
  }, [])

  async function loadTickets(epicKey: string) {
    setError('')
    try {
      setTickets(epicKey ? await agentApi.tickets(epicKey) : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Jira tickets')
    }
  }

  async function perform(action: () => Promise<WorkflowState>) {
    setActionLoading(true)
    setError('')
    try {
      const state = await action()
      setActive(state)
      if (state.runId !== active?.runId) setEvents(state.timeline || [])
      await refreshWorkflow()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Agent action failed')
    } finally {
      setActionLoading(false)
    }
  }

  return {
    doctor,
    epics,
    tickets,
    active,
    history,
    review,
    events,
    loading,
    actionLoading,
    error,
    loadTickets,
    start: (issueKey: string, epicKey: string) =>
      perform(() => agentApi.start(issueKey, epicKey)),
    revise: (instruction: string) => perform(() => agentApi.revise(instruction)),
    approve: () => perform(agentApi.approve),
    push: () => perform(agentApi.push),
    abort: () => perform(agentApi.abort),
    refresh: initialize,
  }
}
