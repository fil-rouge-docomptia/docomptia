export const entryTypeLabels: Record<string, string> = {
  GENERATED: 'Generated', REVERSAL: 'Reversal', CORRECTIVE: 'Corrective',
}

export const entryColumns = [
  ['supplier', 'Supplier'], ['date', 'Entry date'], ['journal', 'Journal'], ['type', 'Type'],
  ['debit', 'Debit'], ['credit', 'Credit'], ['balance', 'Balance'], ['export', 'Export status'],
  ['invoiceStatus', 'Invoice status'], ['invoice', 'Invoice'],
] as const
export type EntryColumn = typeof entryColumns[number][0]
export const entrySortFields: Record<string, string> = {
  entryNumber: 'Entry', supplierName: 'Supplier', entryDate: 'Entry date', journalCode: 'Journal', invoiceNumber: 'Invoice',
}
export function entryExportLabel(record: import('@/types/accounting').AccountingEntryRecord) {
  if (record.exportStatus === 'EXPORTED') return 'Exported'
  if (record.exportEligible === true) return 'Ready to export'
  if (record.exportStatus === 'NOT_EXPORTED') return record.needsAttention ? 'Blocked' : 'Not exported'
  return 'Unavailable'
}
