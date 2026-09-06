import { hasPermission } from '@/lib/permissions'
import type { SupplierDetails, SupplierLegalIdentifier } from '@/types/supplier'

export function canManageSupplier(permissions?: readonly string[]) {
  return hasPermission(permissions, 'supplier.manage')
}

export function getCurrentLegalIdentifier(
  supplier: SupplierDetails,
  scheme: 'EU_VAT' | 'FR_SIRET',
) {
  return supplier.currentLegalIdentifiers.find(
    (identifier) => identifier.scheme === scheme && !identifier.validTo,
  )
}

export function getLegalIdentifierValue(
  supplier: SupplierDetails,
  scheme: 'EU_VAT' | 'FR_SIRET',
) {
  const identifier = getCurrentLegalIdentifier(supplier, scheme)
  if (identifier) {
    return identifier.value
  }

  return scheme === 'FR_SIRET' ? supplier.siret : supplier.vatNumber
}

export function formatSupplierDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date)
}

export function legalIdentifierLabel(identifier: SupplierLegalIdentifier) {
  return `${identifier.countryCode} · ${identifier.scheme.replaceAll('_', ' ')}`
}
