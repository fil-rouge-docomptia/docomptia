import { useEffect, useRef, useState } from 'react'
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileText,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/services/api'
import { getInvoiceFile } from '@/services/invoice'
import type { InvoiceDetails } from '@/types/invoice'

import { getInvoiceFileName } from './invoice-detail-utils'

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.25

let pdfModulePromise: Promise<typeof import('pdfjs-dist')> | null = null

function loadPdfModule() {
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist').then((pdfModule) => {
      pdfModule.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return pdfModule
    })
  }

  return pdfModulePromise
}

type InvoiceDocumentPanelProps = {
  invoice: InvoiceDetails
}

type DocumentFile = {
  blob: Blob
  url: string
}

type FileRequestState = {
  error: 'forbidden' | 'unavailable' | null
  file: DocumentFile | null
  requestKey: string
}

type PdfRequestState = {
  document: PDFDocumentProxy | null
  error: boolean
  fileUrl: string
}

type RenderState = {
  error: boolean
  renderKey: string
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPdfFile(file: DocumentFile, fileName: string) {
  return file.blob.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: DocumentFile) {
  return file.blob.type.startsWith('image/')
}

export function InvoiceDocumentPanel({ invoice }: InvoiceDocumentPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [fileRequestState, setFileRequestState] = useState<FileRequestState>({
    error: null,
    file: null,
    requestKey: '',
  })
  const [pdfRequestState, setPdfRequestState] = useState<PdfRequestState>({
    document: null,
    error: false,
    fileUrl: '',
  })
  const [renderState, setRenderState] = useState<RenderState>({
    error: false,
    renderKey: '',
  })
  const requestKey = `${invoice.invoiceId}:${retryCount}`
  const currentFileRequest = fileRequestState.requestKey === requestKey
  const fileError = currentFileRequest && fileRequestState.error
  const file = currentFileRequest ? fileRequestState.file : null
  const fileName = getInvoiceFileName(invoice.filePath, invoice.invoiceNumber)
  const pdfFile = file ? isPdfFile(file, fileName) : false
  const imageFile = file ? isImageFile(file) : false
  const currentPdfRequest = Boolean(file && pdfRequestState.fileUrl === file.url)
  const pdfDocument = currentPdfRequest ? pdfRequestState.document : null
  const pdfError = currentPdfRequest && pdfRequestState.error
  const totalPages = pdfDocument?.numPages ?? 1
  const renderKey = pdfDocument
    ? `${pdfRequestState.fileUrl}:${pageNumber}:${scale}:${rotation}`
    : ''
  const currentRender = renderState.renderKey === renderKey
  const renderError = currentRender && renderState.error
  const loading = !file && !fileError
  const loadingPdf = pdfFile && !pdfDocument && !pdfError
  const renderingPdf = Boolean(pdfDocument && !currentRender)

  useEffect(() => {
    const controller = new AbortController()

    getInvoiceFile(invoice.invoiceId, controller.signal)
      .then((blob) => {
        setFileRequestState({
          error: null,
          file: { blob, url: URL.createObjectURL(blob) },
          requestKey,
        })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setFileRequestState({
            error: requestError instanceof ApiError && requestError.status === 403 ? 'forbidden' : 'unavailable',
            file: null,
            requestKey,
          })
        }
      })

    return () => controller.abort()
  }, [invoice.invoiceId, requestKey])

  useEffect(() => {
    if (!file) {
      return
    }

    return () => URL.revokeObjectURL(file.url)
  }, [file])

  useEffect(() => {
    if (!file || !pdfFile) {
      return
    }

    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null

    Promise.all([file.blob.arrayBuffer(), loadPdfModule()])
      .then(([data, pdfModule]) => {
        if (cancelled) {
          return null
        }

        loadingTask = pdfModule.getDocument({ data })
        return loadingTask.promise
      })
      .then((document) => {
        if (!document || cancelled) {
          return
        }

        setPageNumber(1)
        setPdfRequestState({ document, error: false, fileUrl: file.url })
      })
      .catch(() => {
        if (!cancelled) {
          setPdfRequestState({ document: null, error: true, fileUrl: file.url })
        }
      })

    return () => {
      cancelled = true
      void loadingTask?.destroy()
    }
  }, [file, pdfFile])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pdfDocument) {
      return
    }

    let cancelled = false
    let renderTask: RenderTask | null = null

    pdfDocument
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) {
          return null
        }

        const viewport = page.getViewport({ rotation, scale })
        const outputScale = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        renderTask = page.render({
          canvas,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        })
        return renderTask.promise
      })
      .then(() => {
        if (!cancelled) {
          setRenderState({ error: false, renderKey })
        }
      })
      .catch((renderErrorValue: unknown) => {
        const errorName = renderErrorValue instanceof Error ? renderErrorValue.name : ''
        if (!cancelled && errorName !== 'RenderingCancelledException') {
          setRenderState({ error: true, renderKey })
        }
      })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pageNumber, pdfDocument, renderKey, rotation, scale])

  const handleDownload = () => {
    if (!file) {
      return
    }

    const link = document.createElement('a')
    link.href = file.url
    link.download = fileName
    link.click()
  }

  const handleFullscreen = () => {
    void panelRef.current?.requestFullscreen()
  }

  const handleFitWidth = async () => {
    if (!pdfDocument || !viewerRef.current) {
      return
    }

    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ rotation, scale: 1 })
    const availableWidth = Math.max(viewerRef.current.clientWidth - 40, 1)
    setScale(clampScale(availableWidth / viewport.width))
  }

  const handleRetry = () => {
    setRetryCount((count) => count + 1)
  }

  const controlsDisabled = !pdfDocument

  return (
    <section
      aria-label="Original invoice document"
      className="flex min-h-[42rem] min-w-0 flex-col bg-card fullscreen:h-screen fullscreen:min-h-screen xl:h-[49rem] fullscreen:xl:h-screen"
      ref={panelRef}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-destructive/10 text-destructive">
            <FileText aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {file
                ? `${pdfFile ? 'PDF' : file.blob.type || 'Document'} · ${pdfDocument ? `${totalPages} ${totalPages === 1 ? 'page' : 'pages'} · ` : ''}${formatFileSize(file.blob.size)}`
                : fileError ? 'Original invoice unavailable' : 'Loading original invoice…'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            aria-label="Download original invoice"
            disabled={!file}
            onClick={handleDownload}
            size="icon"
            title="Download original invoice"
            type="button"
            variant="ghost"
          >
            <Download aria-hidden="true" />
          </Button>
          <Button
            aria-label="Open document full screen"
            disabled={!file}
            onClick={handleFullscreen}
            size="icon"
            title="Open document full screen"
            type="button"
            variant="ghost"
          >
            <Maximize2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-12 flex-wrap items-center justify-between gap-1 border-b border-border px-2 sm:px-4">
        <div className="flex items-center">
          <Button
            aria-label="Zoom out"
            disabled={controlsDisabled || scale <= MIN_SCALE}
            onClick={() => setScale((value) => clampScale(value - SCALE_STEP))}
            size="icon"
            title="Zoom out"
            type="button"
            variant="ghost"
          >
            <Minus aria-hidden="true" />
          </Button>
          <span aria-live="polite" className="w-12 text-center text-xs font-medium text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            aria-label="Zoom in"
            disabled={controlsDisabled || scale >= MAX_SCALE}
            onClick={() => setScale((value) => clampScale(value + SCALE_STEP))}
            size="icon"
            title="Zoom in"
            type="button"
            variant="ghost"
          >
            <Plus aria-hidden="true" />
          </Button>
          <Button
            aria-label="Fit to width"
            disabled={controlsDisabled}
            onClick={handleFitWidth}
            size="icon"
            title="Fit to width"
            type="button"
            variant="ghost"
          >
            <Expand aria-hidden="true" />
          </Button>
          <Button
            aria-label="Rotate document"
            disabled={controlsDisabled}
            onClick={() => setRotation((value) => (value + 90) % 360)}
            size="icon"
            title="Rotate document"
            type="button"
            variant="ghost"
          >
            <RotateCw aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center">
          <Button
            aria-label="Previous page"
            disabled={controlsDisabled || pageNumber <= 1}
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            size="icon"
            title="Previous page"
            type="button"
            variant="ghost"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span aria-live="polite" className="min-w-12 px-1 text-center text-xs font-medium text-muted-foreground">
            {pageNumber} / {totalPages}
          </span>
          <Button
            aria-label="Next page"
            disabled={controlsDisabled || pageNumber >= totalPages}
            onClick={() => setPageNumber((value) => Math.min(totalPages, value + 1))}
            size="icon"
            title="Next page"
            type="button"
            variant="ghost"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-start justify-center overflow-auto bg-muted/70 p-5 sm:p-8"
        ref={viewerRef}
      >
        {loading || loadingPdf ? (
          <div aria-label="Loading original invoice" className="w-full max-w-[25rem] space-y-3">
            <Skeleton className="h-[32rem] w-full rounded-none bg-card" />
          </div>
        ) : fileError || pdfError || renderError || (!pdfFile && !imageFile) ? (
          <Alert className="my-auto max-w-md bg-card" variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>
              {fileError === 'forbidden' ? 'Document access denied' : 'Unable to display the original invoice'}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {fileError === 'forbidden'
                  ? 'You do not have permission to preview or download this document.'
                  : 'Check your connection or download the file to open it locally.'}
              </p>
              {fileError !== 'forbidden' ? (
                <Button onClick={handleRetry} size="sm" type="button" variant="outline">
                  Try again
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : pdfFile ? (
          <div className="relative shrink-0 bg-card shadow-elevation-3">
            <canvas
              aria-label={`Invoice PDF page ${pageNumber}`}
              className={renderingPdf ? 'opacity-50' : 'opacity-100'}
              ref={canvasRef}
              role="img"
            />
            {renderingPdf ? (
              <Skeleton className="absolute inset-0 rounded-none bg-card/70" />
            ) : null}
          </div>
        ) : (
          <img
            alt={`Original invoice ${fileName}`}
            className="max-w-none bg-card shadow-elevation-3"
            src={file?.url}
            style={{
              transform: `rotate(${rotation}deg)`,
              width: `${scale * 100}%`,
            }}
          />
        )}
      </div>
    </section>
  )
}
