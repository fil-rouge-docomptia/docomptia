import { csvCell } from './account-csv'
import type { AccountImportResult, AccountImportRow } from '@/types/account-import'

export const importRowLabels: Record<AccountImportRow['status'], string> = {
  NEW: 'New', EXISTING: 'Skipped (existing)', DUPLICATE: 'Skipped (duplicate)', INVALID: 'Rejected', IMPORTED: 'Imported',
}

export function downloadImportReport(fileName: string, result: AccountImportResult) {
  const rows = [
    ['Line', 'Account number', 'Label', 'Type', 'Active', 'Result', 'Errors', 'Imported at', 'Imported by user ID'],
    ...result.rows.map((row) => [row.lineNumber, row.accountNumber, row.accountLabel, row.accountType, row.active,
      importRowLabels[row.status], row.errors.join('; '), result.importedAt, result.importedByUserId]),
  ]
  const blob = new Blob(['\uFEFF', rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName.replace(/\.csv$/i, '')}-import-report.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
