import {
  Bot,
  GitPullRequestArrow,
  History,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Diagnostics } from './components/Diagnostics'
import { HistoryPanel } from './components/HistoryPanel'
import { ReviewPanel } from './components/ReviewPanel'
import { TicketSelector } from './components/TicketSelector'
import { WorkflowTimeline } from './components/WorkflowTimeline'
import { Alert, AlertDescription } from './components/ui/alert'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { TooltipProvider } from './components/ui/tooltip'
import { useAgentDashboard } from './hooks/useAgentDashboard'

const retryInstruction =
  'Relance l’implémentation du ticket depuis la branche existante. Analyse l’erreur précédente, conserve les changements valides, applique les corrections nécessaires, exécute les tests et crée des commits atomiques.'

type Confirmation = {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  action: () => void
}

export default function App() {
  const dashboard = useAgentDashboard()
  const [view, setView] = useState<'control' | 'history'>('control')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  function confirm(action: Confirmation) {
    setConfirmation(action)
  }

  function runConfirmation() {
    confirmation?.action()
    setConfirmation(null)
  }

  if (dashboard.loading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><Bot size={26} /></div>
        <LoaderCircle className="spin" size={28} />
        <p>Connexion à Jira, Git et Codex…</p>
      </main>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand compact-brand">
              <div className="brand-mark"><Bot size={21} /></div>
              <div><strong>KAN Agent</strong><span>Assistant de développement</span></div>
            </div>
            <Tabs value={view} onValueChange={(value) => setView(value as 'control' | 'history')}>
              <TabsList aria-label="Navigation principale">
                <TabsTrigger value="control"><LayoutDashboard size={16} /> Pilotage</TabsTrigger>
                <TabsTrigger value="history"><History size={16} /> Historique</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="topbar-status">
              <span><LockKeyhole size={13} /> Push protégé</span>
              <Badge variant="outline" className="local-badge">LOCAL · 127.0.0.1</Badge>
            </div>
          </div>
        </header>

        <main className="main-content">
          <section className="hero">
            <div className="hero-orb" />
            <div className="hero-content">
              <div className="hero-copy">
                <span className="hero-kicker"><Sparkles size={14} /> Facturation électronique</span>
                <h1>{view === 'control' ? 'Du ticket Jira au code, sous contrôle.' : 'Chaque exécution reste traçable.'}</h1>
                <p>{view === 'control'
                  ? 'Confie le ticket, observe l’agent travailler et garde la décision finale avant livraison.'
                  : 'Retrouve les branches, commits, tests et incidents de chaque ticket traité.'}</p>
              </div>
              <div className="hero-guardrails">
                <div>
                  <GitPullRequestArrow size={19} />
                  <span><strong>Branche isolée</strong><small>Main reste intacte</small></span>
                </div>
                <div>
                  <ShieldCheck size={19} />
                  <span><strong>Review humaine</strong><small>Avant chaque livraison</small></span>
                </div>
                <div>
                  <LockKeyhole size={19} />
                  <span><strong>Push verrouillé</strong><small>Approbation obligatoire</small></span>
                </div>
              </div>
            </div>
          </section>

          <div className="workspace">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">{view === 'control' ? 'Espace de pilotage' : 'Journal des activités'}</p>
              <h2>{view === 'control' ? 'Superviser une exécution' : 'Historique des tickets'}</h2>
            </div>
            {view === 'control' && (
              <div className="approval-note"><ShieldCheck size={16} /> Aucun push sans ton approbation</div>
            )}
          </header>

          {dashboard.error && (
            <Alert className="error-banner">
              <X size={18} />
              <AlertDescription>{dashboard.error}</AlertDescription>
              <Button variant="ghost" size="icon" onClick={dashboard.refresh} aria-label="Réessayer">
                <X size={17} />
              </Button>
            </Alert>
          )}

          {view === 'control' ? (
            <>
              <Diagnostics doctor={dashboard.doctor} onRefresh={dashboard.refresh} />
              <div className="control-grid">
                <TicketSelector
                  epics={dashboard.epics}
                  tickets={dashboard.tickets}
                  active={dashboard.active}
                  disabled={dashboard.actionLoading || !dashboard.doctor?.ready}
                  onEpicChange={dashboard.loadTickets}
                  onStart={(issueKey, epicKey) => confirm({
                    title: `Lancer ${issueKey} ?`,
                    message: 'L’agent va synchroniser main, créer une branche dédiée, analyser le ticket, modifier le code, tester puis committer. Aucun push ne sera effectué.',
                    confirmLabel: 'Lancer le ticket',
                    action: () => void dashboard.start(issueKey, epicKey),
                  })}
                />
                <WorkflowTimeline
                  active={dashboard.active}
                  events={dashboard.events}
                  retryDisabled={dashboard.actionLoading || Boolean(dashboard.active?.running)}
                  onRetry={() => void dashboard.revise(retryInstruction)}
                />
              </div>
              <ReviewPanel
                active={dashboard.active}
                review={dashboard.review}
                disabled={dashboard.actionLoading || Boolean(dashboard.active?.running)}
                onRevise={(instruction) => void dashboard.revise(instruction)}
                onApprove={() => confirm({
                  title: 'Approuver cette implémentation ?',
                  message: 'Les garde-fous Git, les commits, les fichiers interdits et les derniers résultats de tests seront vérifiés. Aucun push ne sera encore effectué.',
                  confirmLabel: 'Approuver',
                  action: () => void dashboard.approve(),
                })}
                onPush={() => confirm({
                  title: 'Pousser la branche ?',
                  message: 'La branche sera envoyée sur origin, un commentaire sera ajouté dans Jira et le ticket passera en Code Review.',
                  confirmLabel: 'Pousser et mettre Jira à jour',
                  action: () => void dashboard.push(),
                })}
                onAbort={() => confirm({
                  title: 'Arrêter ce workflow ?',
                  message: 'Le workflow sera marqué comme arrêté. La branche et les fichiers seront conservés pour éviter toute perte.',
                  confirmLabel: 'Arrêter le workflow',
                  danger: true,
                  action: () => void dashboard.abort(),
                })}
              />
            </>
          ) : (
            <HistoryPanel history={dashboard.history} />
          )}
          </div>
        </main>

        {dashboard.actionLoading && (
          <div className="action-loader"><LoaderCircle className="spin" size={18} /> Action en cours</div>
        )}
        {confirmation && (
          <ConfirmDialog
            {...confirmation}
            onConfirm={runConfirmation}
            onCancel={() => setConfirmation(null)}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
