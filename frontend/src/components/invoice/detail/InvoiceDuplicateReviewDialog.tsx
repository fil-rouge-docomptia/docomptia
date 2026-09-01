import { useEffect, useId, useState } from 'react'
import { AlertCircle, ExternalLink, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getInvoiceDetails } from '@/services/invoice'
import type {
  InvoiceDetails,
  InvoiceDuplicateAlert,
  InvoiceDuplicateDecision,
} from '@/types/invoice'

import { formatInvoiceDate, formatInvoiceMoney } from './invoice-detail-utils'

type InvoiceDuplicateReviewDialogProps = {
  alert: InvoiceDuplicateAlert | null
  canDecide: boolean
  decisionBlocked: boolean
  decisionError: boolean
  decisionPending: InvoiceDuplicateDecision | null
  invoice: InvoiceDetails
  onDecision: (decision: InvoiceDuplicateDecision, reason?: string) => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
}

type ComparisonRow = {
  currentValue: string
  label: string
  matchingValue: string
  matches: boolean
  usedForDetection: boolean
}

function normalizedValue(value: string) {
  return value.trim().toLocaleLowerCase()
}

function isMatchingValue(currentValue: string, matchingValue: string) {
  if (currentValue === 'Not available' || matchingValue === 'Not available') {
    return false
  }

  return normalizedValue(currentValue) === normalizedValue(matchingValue)
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption className="sr-only">Current and similar invoice comparison</caption>
        <thead className="bg-muted/70 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium" scope="col">Detection criterion</th>
            <th className="px-4 py-3 font-medium" scope="col">Current invoice</th>
            <th className="px-4 py-3 font-medium" scope="col">Similar invoice</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-border align-top" key={row.label}>
              <th className="px-4 py-3 font-medium text-foreground" scope="row">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{row.label}</span>
                  {row.usedForDetection ? (
                    <Badge
                      className={row.matches
                        ? 'border-success/20 bg-success-muted text-success'
                        : 'border-warning/20 bg-warning-muted text-warning-muted-foreground'}
                      variant="outline"
                    >
                      {row.matches ? 'Match' : 'Detection criterion'}
                    </Badge>
                  ) : null}
                </div>
              </th>
              <td className="px-4 py-3 text-muted-foreground">{row.currentValue}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.matchingValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function InvoiceDuplicateReviewDialog({
  alert,
  canDecide,
  decisionBlocked,
  decisionError,
  decisionPending,
  invoice,
  onDecision,
  onOpenChange,
  open,
}: InvoiceDuplicateReviewDialogProps) {
  const reasonId = useId()
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState('')
  const [matchingState, setMatchingState] = useState<{
    error: boolean
    invoice: InvoiceDetails | null
    requestKey: string
  }>({ error: false, invoice: null, requestKey: '' })
  const requestKey = open && alert?.matchingInvoiceId
    ? `${alert.alertId}:${alert.matchingInvoiceId}`
    : ''
  const currentRequest = matchingState.requestKey === requestKey
  const matchingInvoice = currentRequest ? matchingState.invoice : null
  const matchingError = currentRequest && matchingState.error
  const matchingLoading = Boolean(requestKey && !currentRequest)

  useEffect(() => {
    if (!requestKey || !alert?.matchingInvoiceId) {
      return
    }

    const controller = new AbortController()

    getInvoiceDetails(alert.matchingInvoiceId, controller.signal)
      .then((nextInvoice) => {
        setMatchingState({ error: false, invoice: nextInvoice, requestKey })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setMatchingState({ error: true, invoice: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [alert?.matchingInvoiceId, requestKey])

  if (!alert) {
    return null
  }

  const probableDuplicate = alert.type === 'PROBABLE'
  const matchingNumber = matchingInvoice?.invoiceNumber ?? alert.matchingInvoiceNumber
  const matchingSupplier = matchingInvoice?.supplierName ?? invoice.supplierName
  const matchingDate = matchingInvoice?.invoiceDate
    ?? (probableDuplicate ? alert.invoiceDate : null)
  const matchingTotal = matchingInvoice?.totalTtc
    ?? (probableDuplicate ? alert.totalTtc : null)
  const rows: ComparisonRow[] = [
    {
      currentValue: invoice.supplierName ?? 'Not available',
      label: 'Supplier',
      matchingValue: matchingSupplier ?? 'Not available',
      matches: isMatchingValue(
        invoice.supplierName ?? 'Not available',
        matchingSupplier ?? 'Not available',
      ),
      usedForDetection: true,
    },
    {
      currentValue: invoice.invoiceNumber ?? 'Not available',
      label: 'Invoice number',
      matchingValue: matchingNumber ?? 'Not available',
      matches: isMatchingValue(
        invoice.invoiceNumber ?? 'Not available',
        matchingNumber ?? 'Not available',
      ),
      usedForDetection: !probableDuplicate,
    },
    {
      currentValue: formatInvoiceDate(invoice.invoiceDate),
      label: 'Invoice date',
      matchingValue: formatInvoiceDate(matchingDate),
      matches: isMatchingValue(
        formatInvoiceDate(invoice.invoiceDate),
        formatInvoiceDate(matchingDate),
      ),
      usedForDetection: probableDuplicate,
    },
    {
      currentValue: formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode),
      label: 'Total',
      matchingValue: formatInvoiceMoney(matchingTotal, matchingInvoice?.currencyCode ?? invoice.currencyCode),
      matches: isMatchingValue(
        formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode),
        formatInvoiceMoney(matchingTotal, matchingInvoice?.currencyCode ?? invoice.currencyCode),
      ),
      usedForDetection: probableDuplicate,
    },
  ]
  const detectionCriteria = probableDuplicate
    ? 'supplier, invoice date and total amount'
    : 'supplier and invoice number'

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('')
      setRejectMode(false)
    }
    onOpenChange(nextOpen)
  }

  const handleDecision = async (decision: InvoiceDuplicateDecision, decisionReason?: string) => {
    try {
      await onDecision(decision, decisionReason)
    } catch {
      // The parent exposes the request error in this dialog and keeps it open for retry.
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review possible duplicate</DialogTitle>
          <DialogDescription>
            Compare the invoice detected as similar before choosing how to continue.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-warning/30 bg-warning-muted">
          <AlertTitle className="text-sm">{probableDuplicate ? 'Probable duplicate' : 'Certain duplicate'}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            This alert was triggered by matching {detectionCriteria}.
          </AlertDescription>
        </Alert>

        {matchingLoading ? (
          <div aria-label="Loading similar invoice" className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ComparisonTable rows={rows} />
        )}

        {matchingError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Unable to load every similar invoice field</AlertTitle>
            <AlertDescription>
              The saved detection criteria remain visible. You can close and reopen this review to retry.
            </AlertDescription>
          </Alert>
        ) : null}

        {alert.matchingInvoiceId ? (
          <Button asChild className="w-fit" size="sm" variant="link">
            <Link rel="noreferrer" target="_blank" to={`/invoices/${alert.matchingInvoiceId}`}>
              Open similar invoice
              <ExternalLink aria-hidden="true" />
            </Link>
          </Button>
        ) : null}

        {decisionError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to save the decision</AlertTitle>
            <AlertDescription>
              The alert is still pending. Check your access and try again.
            </AlertDescription>
          </Alert>
        ) : null}

        {!canDecide ? (
          <Alert>
            <AlertDescription>
              You can review this match, but your role cannot decide how to process it.
            </AlertDescription>
          </Alert>
        ) : decisionBlocked ? (
          <Alert>
            <AlertDescription>
              Save the invoice field changes before recording a duplicate decision.
            </AlertDescription>
          </Alert>
        ) : rejectMode ? (
          <div className="space-y-2 rounded-lg border border-border p-4">
            <Label htmlFor={reasonId}>Rejection reason</Label>
            <Input
              aria-required="true"
              disabled={Boolean(decisionPending)}
              id={reasonId}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this invoice must be rejected"
              value={reason}
            />
            <p className="text-xs text-muted-foreground">
              The reason will remain visible in the invoice activity.
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:space-x-0">
          {rejectMode ? (
            <>
              <Button
                disabled={Boolean(decisionPending) || decisionBlocked}
                onClick={() => setRejectMode(false)}
                type="button"
                variant="outline"
              >
                Back
              </Button>
              <Button
                disabled={Boolean(decisionPending) || decisionBlocked || !reason.trim()}
                onClick={() => void handleDecision('REJECT', reason.trim())}
                type="button"
                variant="destructive"
              >
                {decisionPending === 'REJECT' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                {decisionPending === 'REJECT' ? 'Rejecting…' : 'Reject invoice'}
              </Button>
            </>
          ) : canDecide ? (
            <>
              <Button
                disabled={Boolean(decisionPending) || decisionBlocked}
                onClick={() => void handleDecision('IGNORE')}
                type="button"
                variant="secondary"
              >
                {decisionPending === 'IGNORE' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                Not a duplicate
              </Button>
              <Button
                disabled={Boolean(decisionPending) || decisionBlocked}
                onClick={() => setRejectMode(true)}
                type="button"
                variant="outline"
              >
                Reject invoice…
              </Button>
              <Button
                disabled={Boolean(decisionPending) || decisionBlocked}
                onClick={() => void handleDecision('CONFIRM')}
                type="button"
                variant="destructive"
              >
                {decisionPending === 'CONFIRM' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                {decisionPending === 'CONFIRM' ? 'Confirming…' : 'Confirm duplicate'}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
