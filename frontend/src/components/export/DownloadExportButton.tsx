import { useEffect, useRef, useState } from 'react'
import { Download, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/api'
import { downloadExport } from '@/services/exports'
import type { ExportBatch } from '@/types/export'

export function DownloadExportButton({ batch, showLabel = false }: {
  batch: Pick<ExportBatch, 'exportBatchId' | 'fileName' | 'format' | 'downloadable'>
  showLabel?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function download() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      const blob = await downloadExport(batch.exportBatchId, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = batch.fileName ?? `export-${batch.exportBatchId}.${batch.format === 'FEC' ? 'txt' : 'csv'}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof ApiError && cause.status === 403 ? 'Download access denied' : cause instanceof ApiError && cause.status === 404 ? 'Export file not found' : 'Download failed. Try again.')
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }
  return <div className="text-right">
    <Button aria-label={`Download export ${batch.exportBatchId}`} className={showLabel ? 'h-11 w-full sm:h-10 sm:w-auto' : 'size-11 p-0 sm:size-10'} disabled={!batch.downloadable || busy} onClick={() => void download()} title={batch.downloadable ? 'Download export' : 'No generated file available'} variant={showLabel ? 'default' : 'ghost'}>
      {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
      {showLabel && (busy ? 'Downloading…' : 'Download file')}
    </Button>
    {error && <p className="mt-1 max-w-64 text-left text-xs text-destructive" role="alert">{error}</p>}
  </div>
}
