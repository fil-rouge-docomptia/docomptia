import { CheckCircle2, FileCode2, GitCommit, Send, ShieldCheck, SquarePen, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { ReviewResponse, WorkflowState } from '../types'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'

type Props = {
  active: WorkflowState | null
  review: ReviewResponse | null
  disabled: boolean
  onRevise: (instruction: string) => void
  onApprove: () => void
  onPush: () => void
  onAbort: () => void
}

export function ReviewPanel({
  active,
  review,
  disabled,
  onRevise,
  onApprove,
  onPush,
  onAbort,
}: Props) {
  const [instruction, setInstruction] = useState('')
  if (!active) return null

  const canRevise = ['REVIEW_REQUIRED', 'APPROVED', 'BLOCKED'].includes(active.status)
  const isBlocked = active.status === 'BLOCKED'
  const canApprove = active.status === 'REVIEW_REQUIRED'
  const canPush = active.status === 'APPROVED'
  const canAbort = !['JIRA_UPDATED', 'ABORTED'].includes(active.status) && !active.running

  return (
    <Card className="panel review-panel">
      <div className="panel-heading compact">
        <div className="heading-icon warm"><ShieldCheck size={20} /></div>
        <div>
          <p className="eyebrow">Contrôle humain</p>
          <h2>Review avant livraison</h2>
        </div>
      </div>

      {isBlocked && (
        <Alert className="blocked-recovery">
          <Wrench size={19} />
          <div>
            <AlertTitle>L’exécution précédente a échoué</AlertTitle>
            <AlertDescription>{active.executionError || 'Une erreur a interrompu l’agent.'}</AlertDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={() => onRevise(
              'Relance l’implémentation du ticket depuis la branche existante. Analyse l’erreur précédente, conserve les changements valides, applique les corrections nécessaires, exécute les tests et crée des commits atomiques.',
            )}
          >
            <Wrench size={17} /> Relancer l’agent
          </Button>
        </Alert>
      )}

      {active.agentResult?.summary && (
        <div className="agent-summary">
          <strong>Résumé de l’agent</strong>
          <p>{active.agentResult.summary}</p>
        </div>
      )}

      <div className="review-grid">
        <div className="review-list">
          <h3><GitCommit size={17} /> Commits</h3>
          {review?.review?.commits.length
            ? review.review.commits.map((commit) => <code key={commit}>{commit}</code>)
            : <p>Aucun commit disponible.</p>}
        </div>
        <div className="review-list">
          <h3><FileCode2 size={17} /> Fichiers</h3>
          {review?.review?.files.length
            ? review.review.files.map((file) => <code key={file}>{file}</code>)
            : <p>Aucun fichier modifié.</p>}
        </div>
      </div>

      <div className="tests-list">
        <h3><CheckCircle2 size={17} /> Vérifications</h3>
        {(review?.tests || active.agentResult?.tests || []).map((test) => (
          <div className={`test-result ${test.status}`} key={test.command}>
            <Badge variant={test.status === 'passed' ? 'success' : 'destructive'}>{test.status}</Badge>
            <code>{test.command}</code>
            <p>{test.details}</p>
          </div>
        ))}
      </div>

      {canRevise && (
        <div className="revision-box">
          <label htmlFor="revision">Demander une correction</label>
          <div>
            <textarea
              id="revision"
              value={instruction}
              placeholder="Exemple : sépare cette logique dans un service ciblé et ajoute le test manquant."
              onChange={(event) => setInstruction(event.target.value)}
            />
            <Button
              variant="secondary"
              type="button"
              disabled={!instruction.trim() || disabled}
              onClick={() => {
                onRevise(instruction)
                setInstruction('')
              }}
            >
              <SquarePen size={17} /> Réviser
            </Button>
          </div>
        </div>
      )}

      <div className="review-actions">
        {canAbort && <Button variant="ghost" className="danger-text" onClick={onAbort}>Arrêter ce workflow</Button>}
        <div>
          {canApprove && (
            <Button variant="secondary" disabled={disabled} onClick={onApprove}>
              <ShieldCheck size={17} /> Approuver
            </Button>
          )}
          {canPush && (
            <Button disabled={disabled} onClick={onPush}>
              Pousser la branche <Send size={17} />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
