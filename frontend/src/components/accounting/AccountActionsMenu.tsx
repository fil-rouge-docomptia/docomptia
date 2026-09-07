import { useRef } from 'react'
import { Ellipsis } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ChartOfAccount } from '@/types/onboarding'

export type AccountActionHandler = (kind: 'edit' | 'deactivate', account: ChartOfAccount, trigger: HTMLElement | null) => void

export function AccountActionsMenu({ account, onAction }: { account: ChartOfAccount, onAction: AccountActionHandler }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)

  function select(kind: 'edit' | 'deactivate') {
    openingDialog.current = true
    onAction(kind, account, trigger.current)
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) openingDialog.current = false }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Actions for account ${account.accountNumber}`} className="size-11 sm:size-10" ref={trigger} size="icon" variant="ghost"><Ellipsis aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Account actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60" onCloseAutoFocus={(event) => { if (openingDialog.current) event.preventDefault() }}>
        <DropdownMenuItem className="min-h-11 text-xs sm:min-h-8" onSelect={() => select('edit')}>Edit account</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 text-xs text-destructive focus:text-destructive sm:min-h-8" disabled={!account.active} onSelect={() => select('deactivate')}>Deactivate account</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
