import { Bot, Check, ChevronDown, ChevronUp, Circle, GitBranch, RotateCcw, TerminalSquare } from 'lucide-react'
import { useState } from 'react'
import type { WorkflowEvent, WorkflowState } from '../types'
import { StatusBadge } from './StatusBadge'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import { Card } from './ui/card'

const steps = [
  ['SELECTED', 'Ticket validé'],
  ['PREPARED', 'Main synchronisé et branche créée'],
  ['IN_PROGRESS', 'Implémentation et tests Codex'],
  ['REVIEW_REQUIRED', 'Review humaine'],
  ['APPROVED', 'Approbation explicite'],
  ['JIRA_UPDATED', 'Push et passage en Code Review'],
]

function stepState(activeStatus: string, stepStatus: string) {
  const current = steps.findIndex(([status]) => status === activeStatus)
  const step = steps.findIndex(([status]) => status === stepStatus)
  if (activeStatus === 'BLOCKED' || activeStatus === 'ABORTED') return step < current ? 'done' : 'pending'
  if (step < current || activeStatus === 'JIRA_UPDATED') return 'done'
  if (step === current || (activeStatus === 'PUSHED' && stepStatus === 'JIRA_UPDATED')) return 'active'
  return 'pending'
}

type Props = {
  active: WorkflowState | null
  events: WorkflowEvent[]
  retryDisabled: boolean
  onRetry: () => void
}

export function WorkflowTimeline({ active, events, retryDisabled, onRetry }: Props) {
  const [showAllEvents, setShowAllEvents] = useState(false)

  if (!active) {
    return (
      <Card className="panel empty-workflow">
        <Bot size={38} />
        <h2>Aucun ticket actif</h2>
        <p>Sélectionne un epic puis un ticket pour voir chaque étape ici.</p>
      </Card>
    )
  }

  const visibleEvents = events.filter((event) => !event.runId || event.runId === active.runId)
  const progressStatus = ['BLOCKED', 'ABORTED'].includes(active.status)
    ? [...visibleEvents]
      .reverse()
      .find((event) => event.type === 'STATE' && steps.some(([status]) => status === event.status))
      ?.status || active.status
    : active.status
  const displayedEvents = showAllEvents ? visibleEvents.slice(-80) : visibleEvents.slice(-12)

  return (
    <Card className="panel workflow-panel">
      <div className="workflow-header">
        <div>
          <p className="eyebrow">Exécution active</p>
          <div className="workflow-title-line">
            <h2>{active.issue.key}</h2>
            <StatusBadge status={active.status} />
          </div>
          <p>{active.issue.summary}</p>
        </div>
        {active.branch && (
          <div className="branch-chip"><GitBranch size={15} /><span>{active.branch}</span></div>
        )}
      </div>

      {active.status === 'BLOCKED' && (
        <Alert className="workflow-retry-banner">
          <RotateCcw size={19} />
          <div>
            <AlertTitle>Cette tentative est bloquée</AlertTitle>
            <AlertDescription>Le correctif est prêt. Relance l’agent sur la branche existante.</AlertDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            disabled={retryDisabled}
            onClick={onRetry}
          >
            <RotateCcw size={17} /> Relancer {active.issue.key}
          </Button>
        </Alert>
      )}

      <div className="stepper">
        {steps.map(([status, label]) => {
          const state = stepState(progressStatus, status)
          return (
            <div className={`step ${state}`} key={status}>
              <span className="step-marker">
                {state === 'done' ? <Check size={14} /> : <Circle size={10} />}
              </span>
              <div>
                <strong>{label}</strong>
                <span>{status}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="console-heading">
        <span><TerminalSquare size={17} /> Journal en direct</span>
        <div>
          {visibleEvents.length > 12 && (
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowAllEvents((current) => !current)}>
              {showAllEvents ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showAllEvents ? 'Réduire' : `Voir tout (${visibleEvents.length})`}
            </Button>
          )}
          <span className={active.running ? 'live-indicator active' : 'live-indicator'}>
            {active.running ? 'LIVE' : 'PAUSE'}
          </span>
        </div>
      </div>
      <div className="event-console">
        {visibleEvents.length === 0 && <p className="console-empty">En attente du premier événement…</p>}
        {displayedEvents.map((event) => (
          <div className={`console-line ${event.level}`} key={event.id}>
            <time>{new Date(event.createdAt).toLocaleTimeString('fr-FR')}</time>
            <span>{event.type}</span>
            <pre>{event.message}</pre>
          </div>
        ))}
      </div>
    </Card>
  )
}
