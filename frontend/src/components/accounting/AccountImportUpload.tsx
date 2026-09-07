import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { formatImportSize } from '@/components/accounting/account-import-utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { AccountImportInspection } from '@/types/account-import'

type Props = {
  file: File | null
  inspection: AccountImportInspection | null
  delimiter: string
  disabled: boolean
  onFile: (file: File | null) => void
  onDelimiter: (delimiter: string) => void
  onError: (message: string) => void
}

export function AccountImportUpload({ file, inspection, delimiter, disabled, onFile, onDelimiter, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const browse = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState(false)

  function selectFiles(files: File[]) {
    if (disabled) return
    if (files.length !== 1) { onError('Choose one CSV file at a time.'); return }
    onFile(files[0])
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Upload a CSV file containing your account number, label, type and active status.</p>
      <div
        className={cn('flex min-h-41 flex-col items-center justify-center gap-3 rounded-md border border-dashed p-6 text-center', dragging && 'border-primary bg-accent')}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles([...event.dataTransfer.files]) }}
      >
        <h3 className="text-base font-semibold">Drop your chart of accounts here</h3>
        <p className="text-xs text-muted-foreground">CSV UTF-8 with headers — up to 20 MB (20 MiB)</p>
        <input accept=".csv,text/csv" aria-label="CSV file" className="sr-only" disabled={disabled} onChange={(event) => { if (event.target.files?.length) selectFiles([...event.target.files]); event.target.value = '' }} ref={input} tabIndex={-1} type="file" />
        <Button disabled={disabled} onClick={() => input.current?.click()} ref={browse} variant="outline">Browse CSV</Button>
      </div>
      {file ? (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <p className="break-all text-sm font-medium">{file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatImportSize(file.size)}{inspection ? ` · ${inspection.totalRows} detected rows` : ' · Awaiting inspection'}</p>
          </div>
          <div className="flex items-center gap-2">
            {inspection ? <Badge className="border-transparent bg-success-muted text-success">Ready</Badge> : null}
            <Button disabled={disabled} onClick={() => { onFile(null); browse.current?.focus() }} variant="ghost"><Trash2 aria-hidden="true" />Remove</Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="csv-separator">Column separator</Label>
        <Select disabled={disabled} onValueChange={onDelimiter} value={delimiter}>
          <SelectTrigger className="w-full sm:w-64" id="csv-separator"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value=",">Comma (,)</SelectItem><SelectItem value=";">Semicolon (;)</SelectItem></SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Up to 10,000 data rows and 100 columns. Account number, label and type are required. Active status accepts true/false or 1/0; blank values default to active.</p>
    </div>
  )
}
