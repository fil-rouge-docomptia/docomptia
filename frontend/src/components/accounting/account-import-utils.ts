import type { AccountImportMapping } from '@/types/account-import'

export const emptyImportMapping: AccountImportMapping = { accountNumber: null, accountLabel: null, accountType: null, active: null }

export function formatImportSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function validateImportFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Choose a CSV file (.csv).'
  if (!['', 'text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'].includes(file.type.toLowerCase())) return 'This file type is not supported. Choose a CSV file.'
  if (file.size === 0) return 'The CSV file is empty.'
  if (file.size > 20 * 1024 * 1024) return 'The CSV file must be no larger than 20 MB (20 MiB).'
  return null
}
