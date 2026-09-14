import { type FormEvent, useId, useState } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'

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
import { createSupplier } from '@/services/supplier'
import type { SupplierDetails } from '@/types/supplier'

type SupplierCreateDialogProps = {
  onCreated: (supplier: SupplierDetails) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'The supplier could not be created. Try again.'
}

export function SupplierCreateDialog({
  onCreated,
  onOpenChange,
  open,
}: SupplierCreateDialogProps) {
  const fieldId = useId()
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [siret, setSiret] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const supplier = await createSupplier({
        address: address.trim(),
        email: email.trim(),
        legalName: legalName.trim(),
        name: name.trim(),
        phone: phone.trim(),
        siret: siret.trim(),
        vatNumber: vatNumber.trim(),
      })
      onCreated(supplier)
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

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>
              Create a supplier for the current organization.
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
              <Label htmlFor={`${fieldId}-siret`}>SIRET</Label>
              <Input
                autoCapitalize="characters"
                id={`${fieldId}-siret`}
                onChange={(event) => setSiret(event.target.value)}
                value={siret}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-vat-number`}>VAT number</Label>
              <Input
                autoCapitalize="characters"
                id={`${fieldId}-vat-number`}
                onChange={(event) => setVatNumber(event.target.value)}
                value={vatNumber}
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

          {errorMessage ? (
            <Alert className="mt-5" variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Unable to create supplier</AlertTitle>
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
            <Button disabled={submitting || !name.trim() || !legalName.trim()} type="submit">
              {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {submitting ? 'Creating…' : 'Create supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
