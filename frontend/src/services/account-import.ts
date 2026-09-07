import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { AccountImportInspection, AccountImportMapping, AccountImportPreview, AccountImportResult } from '@/types/account-import'

function importBody(file: File, delimiter: string, mapping?: AccountImportMapping) {
  const body = new FormData()
  body.append('file', file)
  body.append('delimiter', delimiter)
  if (mapping) body.append('mapping', new Blob([JSON.stringify(mapping)], { type: 'application/json' }))
  return body
}

export async function inspectAccountImport(file: File, delimiter: string, signal: AbortSignal): Promise<AccountImportInspection> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/chart-of-accounts/import/inspect`, {
    method: 'POST', body: importBody(file, delimiter), signal,
  })
  return response.json()
}

export async function previewAccountImport(file: File, delimiter: string, mapping: AccountImportMapping, signal: AbortSignal): Promise<AccountImportPreview> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/chart-of-accounts/import/preview`, {
    method: 'POST', body: importBody(file, delimiter, mapping), signal,
  })
  return response.json()
}

export async function confirmAccountImport(file: File, delimiter: string, mapping: AccountImportMapping, fingerprint: string, excludeInvalidRows: boolean, signal: AbortSignal): Promise<AccountImportResult> {
  const body = importBody(file, delimiter, mapping)
  body.append('fingerprint', fingerprint)
  body.append('excludeInvalidRows', String(excludeInvalidRows))
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/chart-of-accounts/import/confirm`, {
    method: 'POST', body, signal,
  })
  return response.json()
}
