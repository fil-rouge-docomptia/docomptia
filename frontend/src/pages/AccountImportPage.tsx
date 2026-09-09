import { useEffect, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AccountImportColumns } from '@/components/accounting/AccountImportColumns'
import { AccountImportReview } from '@/components/accounting/AccountImportReview'
import { AccountImportFailed, AccountImportPending, AccountImportResults, type AccountImportOutcome } from '@/components/accounting/AccountImportResults'
import { AccountImportUpload } from '@/components/accounting/AccountImportUpload'
import { emptyImportMapping, formatImportSize, validateImportFile } from '@/components/accounting/account-import-utils'
import { AccountingSectionTabs } from '@/components/accounting/AccountingSectionTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/hooks/use-auth'
import { confirmAccountImport, inspectAccountImport, previewAccountImport } from '@/services/account-import'
import { ApiError } from '@/services/api'
import type { AccountImportInspection, AccountImportMapping, AccountImportPreview } from '@/types/account-import'

const steps = ['Upload', 'Map columns', 'Review', 'Import']

export default function AccountImportPage() {
  const { user } = useAuth()
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader description="Upload, validate and import accounts from a CSV file." title="Import chart of accounts" />
      <AccountingSectionTabs value="accounts" />
      {user?.role.code === 'ADMIN' ? <AccountImportWizard key={`${user.id}:${user.organization.id}:${user.role.code}`} /> : (
        <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>Account import access denied</AlertTitle><AlertDescription><p>You do not have access to import accounts for this organization.</p><Button asChild className="mt-3" variant="outline"><Link to="/accounting/accounts">Back to chart of accounts</Link></Button></AlertDescription></Alert>
      )}
    </div>
  )
}

function AccountImportWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [delimiter, setDelimiter] = useState(',')
  const [inspection, setInspection] = useState<AccountImportInspection | null>(null)
  const [mapping, setMapping] = useState<AccountImportMapping>(emptyImportMapping)
  const [preview, setPreview] = useState<AccountImportPreview | null>(null)
  const [excludeInvalid, setExcludeInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<AccountImportOutcome | null>(null)
  const [error, setError] = useState<{ message: string, blocked: boolean } | null>(null)
  const request = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorAlert = useRef<HTMLDivElement>(null)

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    (error ? errorAlert.current : heading.current)?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [step, error, outcome, busy])

  const mappingComplete = mapping.accountNumber !== null && mapping.accountLabel !== null && mapping.accountType !== null
  const canImport = Boolean(preview && preview.newAccounts > 0 && (!preview.invalidRows || excludeInvalid))
  const canContinue = !busy && !outcome && !error?.blocked && (step === 1 ? Boolean(file) : step === 2 ? mappingComplete : canImport)

  function invalidatePreview() {
    setPreview(null)
    setExcludeInvalid(false)
  }

  function chooseFile(next: File | null) {
    const message = next ? validateImportFile(next) : null
    setFile(message ? null : next)
    setInspection(null)
    setMapping(emptyImportMapping)
    invalidatePreview()
    setError(message ? { message, blocked: false } : null)
  }

  async function advance() {
    if (!file || !canContinue || request.current) return
    if (step === 3) { setStep(4); return }
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError(null)
    try {
      if (step === 1) {
        const result = await inspectAccountImport(file, delimiter, controller.signal)
        if (controller.signal.aborted) return
        setInspection(result)
        setStep(2)
      } else if (step === 2) {
        const result = await previewAccountImport(file, delimiter, mapping, controller.signal)
        if (controller.signal.aborted) return
        setPreview(result)
        setExcludeInvalid(false)
        setStep(3)
      } else if (step === 4 && preview) {
        const result = await confirmAccountImport(file, delimiter, mapping, preview.fingerprint, excludeInvalid, controller.signal)
        if (controller.signal.aborted) return
        setOutcome({ kind: 'complete', result })
      }
    } catch (cause) {
      if (controller.signal.aborted) return
      const status = cause instanceof ApiError ? cause.status : null
      const blocked = status === 403 || status === 404 || status === 405 || status === 501
      const message = status === 403 ? 'You do not have access to import accounts for this organization.'
        : blocked ? 'Account import is unavailable at the moment. No import has been confirmed.'
          : status === 409 ? 'The preview has changed. Review the accounts again before confirming.'
            : status === 413 ? 'The file exceeds the upload limit. Choose a smaller CSV file.'
              : status === 400 && cause instanceof ApiError ? cause.message
                : 'The request could not be confirmed. Check your connection and try again.'
      if (step === 4) {
        // A lost response does not prove rollback. Never replay an uncertain confirmation.
        invalidatePreview()
        const code = cause instanceof ApiError ? cause.code : undefined
        const noChanges = status === 403 || status === 404 || status === 405 || status === 413 || status === 501
          || (status === 400 && code === 'ACCOUNT_IMPORT_INVALID') || (status === 409 && code === 'ACCOUNT_IMPORT_PREVIEW_CHANGED')
        setOutcome({ kind: 'failed', failure: { message, blocked, noChanges, code } })
      } else setError({ message, blocked })
    } finally {
      if (!controller.signal.aborted) { setBusy(false); request.current = null }
    }
  }

  function back() {
    if (busy) return
    if (step === 2 || step === 3) invalidatePreview()
    setStep(step - 1)
  }

  function retry() {
    setOutcome(null)
    setError(null)
    invalidatePreview()
    setStep(2)
  }

  function newImport() {
    chooseFile(null)
    setOutcome(null)
    setStep(1)
  }

  const pendingLabel = step === 1 ? 'Inspecting CSV…' : step === 2 ? 'Preparing preview…' : 'Importing accounts…'
  const importing = step === 4 && busy
  const stepLabel = importing ? 'Importing' : outcome?.kind === 'complete' ? outcome.result.invalidRows > 0 ? 'Completed with issues' : 'Import complete' : outcome?.kind === 'failed' ? outcome.failure.noChanges ? 'Import failed' : 'Import not confirmed' : steps[step - 1]
  return (
    <section aria-label="Account import assistant" className="mx-auto w-full max-w-200 space-y-6">
      <div className="space-y-5 rounded-xl border bg-card p-6">
        <div><h2 className="text-xl font-semibold leading-7 tracking-[-0.25px] outline-none" ref={heading} tabIndex={-1}>Import chart of accounts</h2><p aria-live="polite" className="mt-1 text-xs text-muted-foreground">Step {step} of 4 · {stepLabel}</p></div>
        <ol className="grid grid-cols-2 gap-3 sm:flex sm:justify-between">{steps.map((label, index) => <li key={label}><Badge aria-current={index + 1 === step ? 'step' : undefined} className="h-6 font-medium tracking-[0.1px]" variant={index + 1 <= step ? 'default' : 'outline'}>{index + 1} {label}</Badge></li>)}</ol>
        <Progress aria-label={`Import progress: step ${step} of 4`} className="h-2" value={step * 25} />
      </div>
      {error ? <Alert ref={errorAlert} tabIndex={-1} variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{error.blocked ? 'Account import unavailable' : 'Unable to continue'}</AlertTitle><AlertDescription className="break-words">{error.message}</AlertDescription></Alert> : null}
      {importing ? <AccountImportPending /> : outcome?.kind === 'failed' ? <AccountImportFailed failure={outcome.failure} onRetry={retry} /> : outcome?.kind === 'complete' && file ? <AccountImportResults fileName={file.name} onNewImport={newImport} result={outcome.result} /> : <>
      <div aria-busy={busy} className="min-w-0 rounded-lg border bg-card p-6">
        {step === 1 ? <AccountImportUpload delimiter={delimiter} disabled={busy || Boolean(error?.blocked)} file={file} inspection={inspection} onDelimiter={(value) => { setDelimiter(value); setInspection(null); setMapping(emptyImportMapping); invalidatePreview(); setError(null) }} onError={(message) => setError({ message, blocked: false })} onFile={chooseFile} /> : null}
        {step === 2 && inspection ? <AccountImportColumns disabled={busy || Boolean(error?.blocked)} inspection={inspection} mapping={mapping} onChange={(value) => { setMapping(value); invalidatePreview(); setError(null) }} /> : null}
        {step === 3 && preview ? <AccountImportReview excludeInvalid={excludeInvalid} onExcludeInvalid={setExcludeInvalid} preview={preview} /> : null}
        {step === 4 && file && preview ? (
          <div className="space-y-4">
            <div><h3 className="text-base font-semibold">Confirm account import</h3><p className="mt-2 text-sm text-muted-foreground">Only the new, valid accounts shown in the preview will be imported.</p></div>
            <div className="flex flex-wrap justify-between gap-2 border-b py-3 text-xs"><span className="break-all font-medium">{file.name}</span><span className="text-muted-foreground">{formatImportSize(file.size)} · {preview.totalRows} rows</span></div>
            <dl className="space-y-4 text-sm">
              {[
                { label: 'New accounts to import', value: preview.newAccounts },
                { label: 'Existing accounts skipped', value: preview.existingAccounts },
                { label: 'Duplicate rows skipped', value: preview.duplicateAccounts },
                { label: 'Invalid rows excluded', value: preview.invalidRows },
              ].map(({ label, value }) => <div className="flex justify-between gap-3" key={label}><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}
            </dl>
            <p className="rounded-lg bg-warning-muted p-4 text-xs text-warning-foreground">Rows with warnings will not overwrite existing accounts. Existing entries and rule references will be kept.</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {step > 1 ? <Button disabled={busy} onClick={back} variant="outline">Back</Button> : null}
          <Button disabled={busy} onClick={() => navigate('/accounting/accounts')} variant={step === 1 ? 'outline' : 'ghost'}>Cancel</Button>
        </div>
        <Button disabled={!canContinue} onClick={advance}>{busy ? <><LoaderCircle aria-hidden="true" className="animate-spin" /><span role="status">{pendingLabel}</span></> : step === 4 ? 'Import accounts' : 'Continue'}</Button>
      </div>
      </>}
    </section>
  )
}
