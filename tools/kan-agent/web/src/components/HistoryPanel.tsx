import { Archive, CalendarDays, GitBranch } from 'lucide-react'
import type { WorkflowState } from '../types'
import { StatusBadge } from './StatusBadge'
import { Card } from './ui/card'

export function HistoryPanel({ history }: { history: WorkflowState[] }) {
  return (
    <Card className="panel history-panel">
      <div className="panel-heading">
        <div className="heading-icon"><Archive size={20} /></div>
        <div>
          <p className="eyebrow">Traçabilité</p>
          <h2>Historique des exécutions</h2>
        </div>
      </div>
      {history.length === 0 ? (
        <div className="history-empty">Aucun workflow archivé pour le moment.</div>
      ) : (
        <div className="history-list">
          {history.map((state) => (
            <article key={`${state.runId}-${state.updatedAt}`}>
              <div>
                <div className="history-title">
                  <strong>{state.issue.key}</strong>
                  <StatusBadge status={state.status} />
                </div>
                <h3>{state.issue.summary}</h3>
                <p>{state.agentResult?.summary || state.executionError || 'Workflow sans résumé.'}</p>
              </div>
              <div className="history-meta">
                {state.branch && <span><GitBranch size={14} /> {state.branch}</span>}
                <span>
                  <CalendarDays size={14} />
                  {state.status === 'JIRA_UPDATED' ? 'Terminé' : state.status === 'ABORTED' ? 'Arrêté' : 'Mis à jour'} le{' '}
                  {new Date(state.updatedAt).toLocaleString('fr-FR')}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  )
}
