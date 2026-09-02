import { type FormEvent, useId, useState } from 'react'
import { AlertCircle, ArrowLeft, LoaderCircle } from 'lucide-react'

import { getCurrentLegalIdentifier } from '@/components/supplier/detail/supplier-detail-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { ApiError } from '@/services/api'
import { replaceSupplierLegalIdentifier, updateSupplier } from '@/services/supplier'
import type { SupplierDetails } from '@/types/supplier'

type EditMode = 'EU_VAT' | 'FR_SIRET' | 'profile'

type SupplierEditDialogProps = {
  onOpenChange: (open: boolean) => void
  onUpdated: (supplier: SupplierDetails) => void
  open: boolean
  supplier: SupplierDetails
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'The supplier could not be updated. Try again.'
}

export function SupplierEditDialog({
  onOpenChange,
  onUpdated,
  open,
  supplier,
}: SupplierEditDialogProps) {
  const fieldId = useId()
  const [mode, setMode] = useState<EditMode>('profile')
  const [name, setName] = useState(supplier.name)
  const [legalName, setLegalName] = useState(supplier.legalName)
  const [email, setEmail] = useState(supplier.email ?? '')
  const [phone, setPhone] = useState(supplier.phone ?? '')
  const [address, setAddress] = useState(supplier.address ?? '')
  const [identifierValue, setIdentifierValue] = useState('')
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const siret = getCurrentLegalIdentifier(supplier, 'FR_SIRET')
  const vatNumber = getCurrentLegalIdentifier(supplier, 'EU_VAT')

  const profileChanged = name.trim() !== supplier.name
    || legalName.trim() !== supplier.legalName
    || email.trim() !== (supplier.email ?? '')
    || phone.trim() !== (supplier.phone ?? '')
    || address.trim() !== (supplier.address ?? '')

  const handleModeChange = (nextMode: EditMode) => {
    const identifier = nextMode === 'FR_SIRET' ? siret : vatNumber

    setMode(nextMode)
    setIdentifierValue(identifier?.value ?? '')
    setReason('')
    setErrorMessage(null)
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const updatedSupplier = await updateSupplier(supplier.supplierId, {
        address: address.trim(),
        email: email.trim(),
        legalName: legalName.trim(),
        name: name.trim(),
        phone: phone.trim(),
      })
      onUpdated(updatedSupplier)
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleIdentifierSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const identifier = mode === 'FR_SIRET' ? siret : vatNumber
    if (!identifier || mode === 'profile') {
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const updatedSupplier = await replaceSupplierLegalIdentifier(
        supplier.supplierId,
        identifier.identifierId,
        {
          countryCode: identifier.countryCode,
          reason: reason.trim(),
          scheme: identifier.scheme,
          type: identifier.type,
          value: identifierValue.trim(),
        },
      )
      onUpdated(updatedSupplier)
      onOpenChange(false)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!submitting) {
      onOpenChange(nextOpen)
    }
  }

  const identifier = mode === 'FR_SIRET' ? siret : vatNumber
  const identifierLabel = mode === 'FR_SIRET' ? 'SIRET' : 'VAT number'

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {mode === 'profile' ? (
          <form onSubmit={(event) => void handleProfileSubmit(event)}>
            <DialogHeader>
              <DialogTitle>Edit supplier</DialogTitle>
              <DialogDescription>
                Update the supplier identity and contact information.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-legal-name`}>Legal name</Label>
                <Input
                  autoComplete="organization"
                  id={`${fieldId}-legal-name`}
                  onChange={(event) => setLegalName(event.target.value)}
                  required
                  value={legalName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-name`}>Trade name</Label>
                <Input
                  id={`${fieldId}-name`}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-email`}>Email</Label>
                <Input
                  autoComplete="email"
                  id={`${fieldId}-email`}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-phone`}>Phone</Label>
                <Input
                  autoComplete="tel"
                  id={`${fieldId}-phone`}
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  value={phone}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${fieldId}-address`}>Address</Label>
                <Input
                  autoComplete="street-address"
                  id={`${fieldId}-address`}
                  onChange={(event) => setAddress(event.target.value)}
                  value={address}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-lg border border-border p-4">
              <div>
                <h3 className="text-sm font-medium">Legal identifiers</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Replacements are recorded in the supplier activity history.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  disabled={!siret}
                  onClick={() => handleModeChange('FR_SIRET')}
                  type="button"
                  variant="outline"
                >
                  {siret ? `Replace SIRET ${siret.value}` : 'No SIRET to replace'}
                </Button>
                <Button
                  disabled={!vatNumber}
                  onClick={() => handleModeChange('EU_VAT')}
                  type="button"
                  variant="outline"
                >
                  {vatNumber ? `Replace VAT ${vatNumber.value}` : 'No VAT number to replace'}
                </Button>
              </div>
            </div>

            {errorMessage ? (
              <Alert className="mt-5" variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Unable to update supplier</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="mt-5 gap-2 sm:space-x-0">
              <Button
                disabled={submitting}
                onClick={() => handleOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={submitting || !profileChanged || !name.trim() || !legalName.trim()}
                type="submit"
              >
                {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                {submitting ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={(event) => void handleIdentifierSubmit(event)}>
            <DialogHeader>
              <DialogTitle>Replace {identifierLabel}</DialogTitle>
              <DialogDescription>
                The current value remains in the auditable supplier history.
              </DialogDescription>
            </DialogHeader>

            <Button
              className="mt-4 px-0"
              onClick={() => handleModeChange('profile')}
              size="sm"
              type="button"
              variant="link"
            >
              <ArrowLeft aria-hidden="true" />
              Back to supplier details
            </Button>

            <div className="mt-3 space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-identifier`}>New {identifierLabel}</Label>
                <Input
                  autoCapitalize="characters"
                  id={`${fieldId}-identifier`}
                  onChange={(event) => setIdentifierValue(event.target.value)}
                  required
                  value={identifierValue}
                />
                <p className="text-xs text-muted-foreground">
                  Current value: {identifier?.value}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-reason`}>Replacement reason</Label>
                <Input
                  id={`${fieldId}-reason`}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="For example: establishment relocation"
                  required
                  value={reason}
                />
              </div>
            </div>

            {errorMessage ? (
              <Alert className="mt-5" variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>Unable to replace {identifierLabel}</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="mt-5 gap-2 sm:space-x-0">
              <Button
                disabled={submitting}
                onClick={() => handleModeChange('profile')}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={submitting || !identifierValue.trim() || !reason.trim()}
                type="submit"
              >
                {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
                {submitting ? 'Replacing…' : `Replace ${identifierLabel}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
