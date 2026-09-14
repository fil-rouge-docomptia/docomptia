import { useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Check,
  CircleAlert,
  Pencil,
  TriangleAlert,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/services/api'
import { correctInvoice } from '@/services/invoice'
import type {
  InvoiceCorrectionRequest,
  InvoiceDetails,
  InvoiceDuplicateAlert,
  OcrFieldResponse,
} from '@/types/invoice'

import { InvoiceDuplicateWarning } from './InvoiceDuplicateWarning'
import { InvoiceLifecycleNotice } from './InvoiceLifecycleNotice'
import { InvoiceOcrFailureAlert } from './InvoiceOcrFailureAlert'
import { SupplierCombobox } from './SupplierCombobox'
import type { SupplierComboboxValue } from './SupplierCombobox'
import {
  getConfidencePercent,
  getOcrField,
  isLowConfidence,
} from './invoice-detail-utils'

type CorrectionFieldName = Exclude<keyof InvoiceCorrectionRequest, 'supplierId'>

type CorrectionDraft = Record<CorrectionFieldName, string>

type CorrectionState = {
  dirty: boolean
  saving: boolean
}

type FieldDefinition = {
  fieldName: CorrectionFieldName
  inputMode?: 'decimal' | 'text'
  label: string
  required?: boolean
  type?: 'date' | 'text'
}

const invoiceInformationFields: FieldDefinition[] = [
  { fieldName: 'invoiceNumber', label: 'Invoice number', required: true },
  { fieldName: 'invoiceDate', label: 'Issue date', required: true, type: 'date' },
  { fieldName: 'dueDate', label: 'Due date', type: 'date' },
  { fieldName: 'commandReference', label: 'PO / Reference' },
]

const amountFields: FieldDefinition[] = [
  { fieldName: 'totalHt', inputMode: 'decimal', label: 'Subtotal', required: true },
  { fieldName: 'totalTva', inputMode: 'decimal', label: 'Tax', required: true },
  { fieldName: 'totalTtc', inputMode: 'decimal', label: 'Total', required: true },
]

const correctionFields = [
  ...invoiceInformationFields,
  ...amountFields,
]

function getCorrectionDraft(invoice: InvoiceDetails): CorrectionDraft {
  return {
    commandReference: invoice.commandReference ?? '',
    dueDate: invoice.dueDate ?? '',
    invoiceDate: invoice.invoiceDate ?? '',
    invoiceNumber: invoice.invoiceNumber ?? '',
    totalHt: invoice.totalHt ?? '',
    totalTtc: invoice.totalTtc ?? '',
    totalTva: invoice.totalTva ?? '',
  }
}

function getSupplierValue(invoice: InvoiceDetails): SupplierComboboxValue | null {
  if (!invoice.supplier) {
    return null
  }

  return {
    countryCode: invoice.supplier.currentCountryCode,
    identifiers: invoice.supplier.snapshotIdentifiers
      ? [invoice.supplier.snapshotIdentifiers]
      : [],
    legalName: invoice.supplier.currentLegalName,
    supplierId: invoice.supplier.supplierId,
    tradeName: invoice.supplier.currentTradeName,
  }
}

function getCorrections(
  draft: CorrectionDraft,
  invoice: InvoiceDetails,
): InvoiceCorrectionRequest {
  const original = getCorrectionDraft(invoice)
  const changedEntries = correctionFields.flatMap(({ fieldName }) => {
    const value = draft[fieldName].trim()
    return value === original[fieldName] ? [] : [[fieldName, value] as const]
  })

  return Object.fromEntries(changedEntries) as InvoiceCorrectionRequest
}

function FieldStatus({
  changed,
  field,
  missing,
}: {
  changed: boolean
  field?: OcrFieldResponse
  missing: boolean
}) {
  const confidence = getConfidencePercent(field)

  if (changed) {
    return (
      <div className="flex items-center gap-1.5 text-info">
        <Pencil aria-hidden="true" className="size-3.5" />
        <Badge className="border-info/20 bg-info-muted text-info" variant="outline">
          Unsaved change
        </Badge>
      </div>
    )
  }

  if (field?.corrected) {
    return (
      <div className="flex items-center gap-1.5 text-info">
        <Pencil aria-hidden="true" className="size-3.5" />
        <Badge className="border-info/20 bg-info-muted text-info" variant="outline">
          Edited manually
        </Badge>
      </div>
    )
  }

  if (missing) {
    return (
      <div className="flex items-center gap-1.5 text-destructive">
        <CircleAlert aria-hidden="true" className="size-3.5" />
        <Badge variant="destructive">Missing field</Badge>
      </div>
    )
  }

  if (confidence === null) {
    return null
  }

  if (isLowConfidence(field)) {
    return (
      <div className="flex items-center gap-1.5 text-warning">
        <TriangleAlert aria-hidden="true" className="size-3.5" />
        <Badge
          className="border-warning/20 bg-warning-muted text-warning-muted-foreground"
          variant="outline"
        >
          Low confidence · {confidence}%
        </Badge>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-success">
      <Check aria-hidden="true" className="size-3.5" />
      <Badge className="border-success/20 bg-success-muted text-success" variant="outline">
        High confidence · {confidence}%
      </Badge>
    </div>
  )
}

function InvoiceField({
  canEdit,
  changed,
  definition,
  field,
  onValueChange,
  value,
}: {
  canEdit: boolean
  changed: boolean
  definition: FieldDefinition
  field?: OcrFieldResponse
  onValueChange: (value: string) => void
  value: string
}) {
  const inputId = useId()
  const helperId = useId()
  const missing = Boolean(definition.required && !value.trim())
  const requiresReview = missing || (!changed && !field?.corrected && isLowConfidence(field))
  const originalValueVisible = Boolean(
    field?.corrected && field.rawValue && field.rawValue !== value,
  )

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground" htmlFor={inputId}>
          {definition.label}
        </Label>
        <Input
          aria-describedby={originalValueVisible ? helperId : undefined}
          aria-invalid={missing}
          aria-required={definition.required}
          className={
            missing
              ? 'h-9 border-destructive text-destructive focus-visible:ring-destructive'
              : requiresReview
                ? 'h-9 border-warning bg-warning-muted/40 focus-visible:ring-warning'
                : 'h-9 border-input'
          }
          disabled={!canEdit}
          id={inputId}
          inputMode={definition.inputMode}
          onChange={(event) => onValueChange(event.target.value)}
          type={definition.type ?? 'text'}
          value={value}
        />
        {originalValueVisible ? (
          <p className="text-xs text-muted-foreground" id={helperId}>
            Original OCR: {field?.rawValue}
          </p>
        ) : null}
      </div>

      <FieldStatus changed={changed} field={field} missing={missing} />
    </div>
  )
}

function DetailSection({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: string
  title: string
}) {
  return (
    <section className="space-y-3 border-b border-border pb-6 last:border-0 last:pb-0">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-[-0.25px] text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

type InvoiceDetailsTabProps = {
  canEdit: boolean
  canProcessDuplicate: boolean
  duplicateAlert: InvoiceDuplicateAlert | null
  duplicateDecisionError: boolean
  duplicateDecisionPending: boolean
  invoice: InvoiceDetails
  onCorrectionStateChange: (state: CorrectionState) => void
  onIgnoreDuplicate: () => Promise<void>
  onInvoiceUpdated: (invoice: InvoiceDetails) => void
  onReviewDuplicate: () => void
}

export function InvoiceDetailsTab({
  canEdit,
  canProcessDuplicate,
  duplicateAlert,
  duplicateDecisionError,
  duplicateDecisionPending,
  invoice,
  onCorrectionStateChange,
  onIgnoreDuplicate,
  onInvoiceUpdated,
  onReviewDuplicate,
}: InvoiceDetailsTabProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const supplierInputId = useId()
  const [draft, setDraft] = useState(() => getCorrectionDraft(invoice))
  const [selectedSupplier, setSelectedSupplier] = useState(() => getSupplierValue(invoice))
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const fieldCorrections = getCorrections(draft, invoice)
  const supplierChanged = (selectedSupplier?.supplierId ?? null)
    !== (invoice.supplier?.supplierId ?? null)
  const corrections: InvoiceCorrectionRequest = supplierChanged && selectedSupplier
    ? { ...fieldCorrections, supplierId: selectedSupplier.supplierId }
    : fieldCorrections
  const changedFields = new Set(Object.keys(fieldCorrections) as CorrectionFieldName[])
  const hasCorrections = Object.keys(corrections).length > 0
  const missingCount = (selectedSupplier ? 0 : 1) + correctionFields.filter(
    ({ fieldName, required }) => required && !draft[fieldName].trim(),
  ).length
  const lowConfidenceCount = correctionFields.filter(({ fieldName }) => (
    draft[fieldName].trim()
    && !changedFields.has(fieldName)
    && !getOcrField(invoice, fieldName)?.corrected
    && isLowConfidence(getOcrField(invoice, fieldName))
  )).length
  const reviewCount = missingCount + lowConfidenceCount
  const reviewMessage = missingCount > 0 && lowConfidenceCount > 0
    ? `Check ${missingCount} missing and ${lowConfidenceCount} low-confidence values before requesting approval.`
    : missingCount > 0
      ? `Complete ${missingCount} missing ${missingCount === 1 ? 'field' : 'fields'} before requesting approval.`
      : `Check ${lowConfidenceCount} low-confidence ${lowConfidenceCount === 1 ? 'value' : 'values'} before requesting approval.`

  const handleValueChange = (fieldName: CorrectionFieldName, value: string) => {
    const nextDraft = { ...draft, [fieldName]: value }
    setDraft(nextDraft)
    setSaveStatus('idle')
    setSaveErrorMessage('')
    onCorrectionStateChange({
      dirty: supplierChanged || Object.keys(getCorrections(nextDraft, invoice)).length > 0,
      saving: false,
    })
  }

  const handleSupplierChange = (supplier: SupplierComboboxValue) => {
    setSelectedSupplier(supplier)
    setSaveStatus('idle')
    setSaveErrorMessage('')
    onCorrectionStateChange({
      dirty: supplier.supplierId !== (invoice.supplier?.supplierId ?? null)
        || Object.keys(fieldCorrections).length > 0,
      saving: false,
    })
  }

  const renderField = (definition: FieldDefinition) => (
    <InvoiceField
      canEdit={canEdit}
      changed={changedFields.has(definition.fieldName)}
      definition={definition}
      field={getOcrField(invoice, definition.fieldName)}
      key={definition.fieldName}
      onValueChange={(value) => handleValueChange(definition.fieldName, value)}
      value={draft[definition.fieldName]}
    />
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canEdit || !hasCorrections) {
      return
    }

    setSaveStatus('saving')
    onCorrectionStateChange({ dirty: true, saving: true })

    try {
      const updatedInvoice = await correctInvoice(invoice.invoiceId, corrections)
      setDraft(getCorrectionDraft(updatedInvoice))
      setSelectedSupplier(getSupplierValue(updatedInvoice))
      setSaveStatus('saved')
      setSaveErrorMessage('')
      onInvoiceUpdated(updatedInvoice)
      onCorrectionStateChange({ dirty: false, saving: false })
    } catch (saveError) {
      setSaveStatus('error')
      setSaveErrorMessage(
        saveError instanceof ApiError && saveError.status === 409
          ? saveError.message
          : 'Your changes are still available. Check the values and try again.',
      )
      onCorrectionStateChange({ dirty: true, saving: false })
    }
  }

  const handleStartManualCorrection = () => {
    formRef.current
      ?.querySelector<HTMLElement>('button[role="combobox"]:not(:disabled), input:not(:disabled)')
      ?.focus()
  }

  return (
    <form
      className="space-y-6 p-4"
      id="invoice-correction-form"
      onSubmit={handleSubmit}
      ref={formRef}
    >
      {duplicateAlert || invoice.status === 'ARCHIVEE' ? null : <InvoiceLifecycleNotice invoice={invoice} />}

      {invoice.status === 'ERREUR_OCR' || invoice.status === 'ERREUR_TRAITEMENT' ? (
        <InvoiceOcrFailureAlert
          canCorrect={canEdit}
          error={invoice.ocrError}
          onStartManualCorrection={handleStartManualCorrection}
        />
      ) : duplicateAlert ? (
        <InvoiceDuplicateWarning
          alert={duplicateAlert}
          canDecide={canProcessDuplicate}
          decisionBlocked={changedFields.size > 0}
          decisionError={duplicateDecisionError}
          decisionPending={duplicateDecisionPending}
          invoice={invoice}
          onIgnore={onIgnoreDuplicate}
          onReview={onReviewDuplicate}
        />
      ) : reviewCount > 0 && invoice.status !== 'ARCHIVEE' ? (
        <Alert className="border-warning/30 bg-warning-muted">
          <AlertTitle className="text-sm">
            {reviewCount} {reviewCount === 1 ? 'field requires' : 'fields require'} review
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {reviewMessage}
          </AlertDescription>
        </Alert>
      ) : null}

      {saveStatus === 'error' ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to save corrections</AlertTitle>
          <AlertDescription>{saveErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {saveStatus === 'saved' ? (
        <p className="text-sm text-success" role="status">Corrections saved.</p>
      ) : null}

      <DetailSection
        description="Legal identity matched against the supplier directory."
        title="Supplier"
      >
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label
              className="text-xs font-medium text-foreground"
              htmlFor={supplierInputId}
            >
              Supplier
            </Label>
            <SupplierCombobox
              disabled={!canEdit}
              id={supplierInputId}
              onValueChange={handleSupplierChange}
              value={selectedSupplier}
            />
          </div>
          <FieldStatus
            changed={supplierChanged}
            field={getOcrField(invoice, 'supplierName')}
            missing={!selectedSupplier}
          />
        </div>
      </DetailSection>

      <DetailSection
        description="Core identifiers and document dates extracted by OCR."
        title="Invoice information"
      >
        {invoiceInformationFields.map(renderField)}
      </DetailSection>

      <DetailSection
        description={`Amounts extracted from the invoice in ${invoice.currencyCode ?? 'the source currency'}.`}
        title="Amounts"
      >
        {amountFields.map(renderField)}
      </DetailSection>

      <DetailSection
        description="Operational dimensions used for accounting and reporting."
        title="Classification"
      >
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <Label className="text-xs font-medium text-foreground">Category</Label>
          <Input
            className="h-9 border-input"
            disabled
            value={invoice.classification?.name ?? 'Not available'}
          />
        </div>
      </DetailSection>
    </form>
  )
}
