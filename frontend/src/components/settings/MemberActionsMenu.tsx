import { useRef } from 'react'
import { Ellipsis } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { OrganizationUser } from '@/types/onboarding'

export type MemberAction = 'edit' | 'role' | 'status'
export type MemberActionHandler = (action: MemberAction, member: OrganizationUser, trigger: HTMLElement | null) => void

export function MemberActionsMenu({ member, protectedAdmin, onAction }: { member: OrganizationUser, protectedAdmin: boolean, onAction: MemberActionHandler }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  function select(action: MemberAction) {
    openingDialog.current = true
    onAction(action, member, trigger.current)
  }

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) openingDialog.current = false }}>
      <Tooltip>
        <TooltipTrigger asChild><DropdownMenuTrigger asChild><Button aria-label={`Actions for ${member.firstName} ${member.lastName}`} className="size-11 bg-accent text-accent-foreground hover:bg-accent/80 sm:size-10" ref={trigger} size="icon" variant="ghost"><Ellipsis aria-hidden="true" /></Button></DropdownMenuTrigger></TooltipTrigger>
        <TooltipContent>Member actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-[248px]" onCloseAutoFocus={(event) => { if (openingDialog.current) event.preventDefault() }}>
        <DropdownMenuItem className="min-h-11 text-xs sm:min-h-8" onSelect={() => select('edit')}>Edit member</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 text-xs sm:min-h-8" disabled={protectedAdmin} onSelect={() => select('role')}>Change role</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 text-xs sm:min-h-8" disabled={protectedAdmin} onSelect={() => select('status')}>{member.active ? 'Deactivate member' : 'Activate member'}</DropdownMenuItem>
        {protectedAdmin ? <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">The last active administrator must keep their role and access.</DropdownMenuLabel> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
