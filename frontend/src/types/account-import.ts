export type AccountImportMapping = {
  accountNumber: number | null
  accountLabel: number | null
  accountType: number | null
  active: number | null
}

export type AccountImportInspection = {
  fileName: string
  fileSize: number
  delimiter: string
  columns: string[]
  totalRows: number
  sampleRows: string[][]
}

export type AccountImportRow = {
  lineNumber: number
  accountNumber: string
  accountLabel: string
  accountType: string
  active: boolean
  status: 'NEW' | 'EXISTING' | 'DUPLICATE' | 'INVALID' | 'IMPORTED'
  errors: string[]
}

export type AccountImportPreview = {
  fingerprint: string
  totalRows: number
  newAccounts: number
  existingAccounts: number
  duplicateAccounts: number
  invalidRows: number
  rows: AccountImportRow[]
}

export type AccountImportResult = {
  imported: number
  existingAccounts: number
  duplicateAccounts: number
  invalidRows: number
  importedByUserId: number
  importedAt: string
  rows: AccountImportRow[]
}
