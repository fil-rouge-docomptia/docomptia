import { ArrowRight, BookOpen, CheckCircle2, GitBranch, ListTodo } from 'lucide-react'
import { useState } from 'react'
import type { Issue, WorkflowState } from '../types'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

type Props = {
  epics: Issue[]
  tickets: Issue[]
  active: WorkflowState | null
  disabled: boolean
  onEpicChange: (key: string) => Promise<void>
  onStart: (ticketKey: string, epicKey: string) => void
}

const terminalStatuses = ['JIRA_UPDATED', 'ABORTED']

export function TicketSelector({
  epics,
  tickets,
  active,
  disabled,
  onEpicChange,
  onStart,
}: Props) {
  const [epicKey, setEpicKey] = useState('')
  const [ticketKey, setTicketKey] = useState('')
  const selectedTicket = tickets.find((ticket) => ticket.key === ticketKey)
  const ticketLocked = active && !terminalStatuses.includes(active.status)

  async function selectEpic(key: string) {
    setEpicKey(key)
    setTicketKey('')
    await onEpicChange(key)
  }

  return (
    <Card className="panel ticket-selector">
      <div className="panel-heading">
        <div className="heading-icon"><BookOpen size={20} /></div>
        <div>
          <p className="eyebrow">Nouvelle exécution</p>
          <h2>Choisir le travail à confier</h2>
        </div>
      </div>

      {ticketLocked ? (
        <Alert className="locked-ticket">
          <GitBranch size={20} />
          <div>
            <AlertTitle>{active.issue.key} est déjà actif</AlertTitle>
            <AlertDescription>Termine, approuve ou arrête ce workflow avant d’en démarrer un autre.</AlertDescription>
          </div>
        </Alert>
      ) : (
        <>
          <div className="form-field">
            <label htmlFor="epic-select"><BookOpen size={14} /> Epic Jira</label>
            <Select value={epicKey} onValueChange={(value) => void selectEpic(value)}>
              <SelectTrigger id="epic-select">
                <SelectValue placeholder="Sélectionner un epic" />
              </SelectTrigger>
              <SelectContent>
              {epics.map((epic) => (
                <SelectItem value={epic.key} key={epic.key}>
                  <span className="select-option"><strong>{epic.key}</strong><span>{epic.summary}</span></span>
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <label htmlFor="ticket-select"><ListTodo size={14} /> Ticket backend</label>
            <Select value={ticketKey} disabled={!epicKey} onValueChange={setTicketKey}>
              <SelectTrigger id="ticket-select">
                <SelectValue placeholder="Sélectionner un ticket" />
              </SelectTrigger>
              <SelectContent>
              {tickets.map((ticket) => (
                <SelectItem value={ticket.key} key={ticket.key}>
                  <span className="select-option ticket-option">
                    <strong>{ticket.key}</strong>
                    <span>{ticket.summary}</span>
                    <em>{ticket.status}</em>
                  </span>
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTicket && (
            <article className="ticket-preview">
              <div className="ticket-preview-meta">
                <span>{selectedTicket.key}</span>
                <Badge variant="secondary"><CheckCircle2 size={12} /> {selectedTicket.status}</Badge>
              </div>
              <h3>{selectedTicket.summary}</h3>
              <div className="ticket-description">
                <strong>Description du ticket</strong>
                <p>{selectedTicket.description || 'Aucune description Jira.'}</p>
              </div>
              {selectedTicket.acceptanceCriteria && (
                <div className="acceptance-preview">
                  <strong>Critères d’acceptation</strong>
                  <p>{selectedTicket.acceptanceCriteria}</p>
                </div>
              )}
            </article>
          )}

          <Button
            className="w-full"
            size="lg"
            type="button"
            disabled={!ticketKey || disabled}
            onClick={() => onStart(ticketKey, epicKey)}
          >
            Confirmer et lancer l’agent
            <ArrowRight size={18} />
          </Button>
        </>
      )}
    </Card>
  )
}
