import { CheckCircle2, CircleAlert, RefreshCw, ServerCog } from 'lucide-react'
import type { DoctorResult } from '../types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

type Props = {
  doctor: DoctorResult | null
  onRefresh: () => void
}

export function Diagnostics({ doctor, onRefresh }: Props) {
  return (
    <Card className="diagnostics-card">
      <div className="diagnostics-title">
        <ServerCog size={19} />
        <div>
        <p className="eyebrow">Environnement</p>
        <h2>{doctor?.ready ? 'Agent prêt' : 'Configuration à vérifier'}</h2>
        </div>
      </div>
      <div className="diagnostic-checks">
        {doctor?.checks.map((check) => (
          <Tooltip key={check.name}>
            <TooltipTrigger asChild>
              <Badge variant={check.status === 'ready' ? 'default' : 'destructive'}>
                {check.status === 'ready' ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}
                {check.name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{check.details}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" type="button" onClick={onRefresh} aria-label="Actualiser">
            <RefreshCw size={17} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Actualiser les connexions</TooltipContent>
      </Tooltip>
    </Card>
  )
}
