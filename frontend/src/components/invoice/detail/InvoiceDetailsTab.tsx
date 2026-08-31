import { useId } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { InvoiceDetails, OcrFieldResponse } from '@/types/invoice'

import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getConfidencePercent,
  getOcrField,
  isLowConfidence,
} from './invoice-detail-utils'

type ReviewField = {
  fieldName: string
  value: string | null
}

function InvoiceField({
  field,
  label,
  required = false,
  value,
}: {
  field?: OcrFieldResponse
  label: string
  required?: boolean
  value: string | null
}) {
  const inputId = useId()
  const confidence = getConfidencePercent(field)
  const missing = !value
  const requiresReview = (required && missing) || isLowConfidence(field)

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label className="text-xs font-medium text-foreground" htmlFor={inputId}>{label}</Label>
        {field?.corrected ? (
          <Badge className="gap-1 border-success/20 bg-success-muted text-success" variant="outline">
            <Check aria-hidden="true" className="size-3" />
            Corrected
          </Badge>
        ) : confidence !== null ? (
          <Badge
            className={
              requiresReview
                ? 'border-warning/20 bg-warning-muted text-warning-muted-foreground'
                : 'border-success/20 bg-success-muted text-success'
            }
            variant="outline"
          >
            {confidence}% confidence
          </Badge>
        ) : null}
      </div>
      <Input
        aria-invalid={requiresReview}
        className={requiresReview ? 'border-warning bg-warning-muted/40' : 'border-border'}
        id={inputId}
        readOnly
        value={value ?? 'Not available'}
      />
    </div>
  )
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="space-y-4 border-b border-border pb-6 last:border-0 last:pb-0">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function InvoiceDetailsTab({ invoice }: { invoice: InvoiceDetails }) {
  const reviewFields: ReviewField[] = [
    { fieldName: 'supplierName', value: invoice.supplierName },
    { fieldName: 'invoiceNumber', value: invoice.invoiceNumber },
    { fieldName: 'invoiceDate', value: invoice.invoiceDate },
    { fieldName: 'totalHt', value: invoice.totalHt },
    { fieldName: 'totalTva', value: invoice.totalTva },
    { fieldName: 'totalTtc', value: invoice.totalTtc },
  ]
  const missingCount = reviewFields.filter(({ value }) => !value).length
  const lowConfidenceCount = reviewFields.filter(
    ({ fieldName, value }) => value && isLowConfidence(getOcrField(invoice, fieldName)),
  ).length
  const reviewCount = missingCount + lowConfidenceCount
  const reviewMessage = missingCount > 0 && lowConfidenceCount > 0
    ? `Check ${missingCount} missing and ${lowConfidenceCount} low-confidence values before requesting approval.`
    : missingCount > 0
      ? `Complete ${missingCount} missing ${missingCount === 1 ? 'field' : 'fields'} before requesting approval.`
      : `Check ${lowConfidenceCount} low-confidence ${lowConfidenceCount === 1 ? 'value' : 'values'} before requesting approval.`

  return (
    <div className="space-y-6 p-4">
      {reviewCount > 0 ? (
        <Alert className="border-warning/30 bg-warning-muted">
          <AlertTriangle aria-hidden="true" className="text-warning" />
          <AlertTitle className="text-sm">
            {reviewCount} {reviewCount === 1 ? 'field requires' : 'fields require'} review
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {reviewMessage}
          </AlertDescription>
        </Alert>
      ) : null}

      <DetailSection title="Supplier">
        <InvoiceField
          field={getOcrField(invoice, 'supplierName')}
          label="Supplier name"
          required
          value={invoice.supplierName}
        />
      </DetailSection>

      <DetailSection title="Invoice information">
        <div className="grid gap-4 sm:grid-cols-2">
          <InvoiceField
            field={getOcrField(invoice, 'invoiceNumber')}
            label="Invoice number"
            required
            value={invoice.invoiceNumber}
          />
          <InvoiceField
            field={getOcrField(invoice, 'invoiceDate')}
            label="Issue date"
            required
            value={invoice.invoiceDate ? formatInvoiceDate(invoice.invoiceDate) : null}
          />
          <InvoiceField
            field={getOcrField(invoice, 'dueDate')}
            label="Due date"
            value={invoice.dueDate ? formatInvoiceDate(invoice.dueDate) : null}
          />
          <InvoiceField
            field={getOcrField(invoice, 'commandReference')}
            label="PO / Reference"
            value={invoice.commandReference}
          />
        </div>
      </DetailSection>

      <DetailSection title="Amounts">
        <div className="grid gap-4 sm:grid-cols-2">
          <InvoiceField label="Currency" value={invoice.currencyCode} />
          <InvoiceField
            field={getOcrField(invoice, 'totalHt')}
            label="Subtotal"
            required
            value={invoice.totalHt ? formatInvoiceMoney(invoice.totalHt, invoice.currencyCode) : null}
          />
          <InvoiceField
            field={getOcrField(invoice, 'totalTva')}
            label="Tax"
            required
            value={invoice.totalTva ? formatInvoiceMoney(invoice.totalTva, invoice.currencyCode) : null}
          />
          <InvoiceField
            field={getOcrField(invoice, 'totalTtc')}
            label="Total"
            required
            value={invoice.totalTtc ? formatInvoiceMoney(invoice.totalTtc, invoice.currencyCode) : null}
          />
        </div>
      </DetailSection>

      <DetailSection title="Classification">
        <InvoiceField label="Category" value={invoice.classification?.name ?? null} />
      </DetailSection>
    </div>
  )
}
