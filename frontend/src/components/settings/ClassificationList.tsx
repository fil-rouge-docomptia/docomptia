import { Archive, Pencil } from 'lucide-react'

import { classificationTypeLabel } from '@/components/settings/classification-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Classification } from '@/types/classification'

type ClassificationListProps = {
  categories: Classification[]
  canManage: boolean
  onEdit: (category: Classification, trigger: HTMLButtonElement) => void
  onDeactivate: (category: Classification, trigger: HTMLButtonElement) => void
}

export function ClassificationList({ categories, canManage, onEdit, onDeactivate }: ClassificationListProps) {
  return (
    <Table aria-label="Organization categories" className="table-fixed max-sm:block">
      <TableHeader className="bg-muted max-sm:sr-only">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 px-3 text-xs text-foreground">Name</TableHead>
          <TableHead className="h-10 w-28 px-3 text-xs text-foreground">Type</TableHead>
          <TableHead className="h-10 w-24 px-3 text-xs text-foreground">Status</TableHead>
          {canManage ? <TableHead className="h-10 w-28 px-3 text-right text-xs text-foreground">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody className="max-sm:block">
        {categories.map((category) => (
          <TableRow className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-2 max-sm:py-3" key={category.classificationId}>
            <TableCell className="px-3 py-3 max-sm:col-span-2 max-sm:block max-sm:pb-1">
              <p className="break-words text-sm font-medium sm:text-xs">{category.name}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{category.description || 'No description'}</p>
            </TableCell>
            <TableCell className="px-3 py-2 text-xs text-muted-foreground max-sm:block">{classificationTypeLabel(category.type)}</TableCell>
            <TableCell className="px-3 py-2 max-sm:block max-sm:text-right">
              <Badge className={category.active ? 'border-transparent bg-success-muted text-success' : undefined} variant={category.active ? 'outline' : 'secondary'}>{category.active ? 'Active' : 'Inactive'}</Badge>
            </TableCell>
            {canManage ? (
              <TableCell className="px-2 py-1 max-sm:col-span-2 max-sm:block">
                <div className="flex justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild><Button aria-label={`Edit ${category.name}`} className="size-11 bg-accent text-accent-foreground" onClick={(event) => onEdit(category, event.currentTarget)} size="icon" variant="ghost"><Pencil aria-hidden="true" /></Button></TooltipTrigger>
                    <TooltipContent>Edit category</TooltipContent>
                  </Tooltip>
                  {category.active ? (
                    <Tooltip>
                      <TooltipTrigger asChild><Button aria-label={`Deactivate ${category.name}`} className="size-11 text-destructive hover:text-destructive" onClick={(event) => onDeactivate(category, event.currentTarget)} size="icon" variant="ghost"><Archive aria-hidden="true" /></Button></TooltipTrigger>
                      <TooltipContent>Deactivate category</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
