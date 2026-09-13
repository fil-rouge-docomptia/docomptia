import type { AccountingEntryLine, AccountingEntryLineCorrectionRequest } from '@/types/invoice'

export type AccountingLineDraft = {
  accountId: string; lineLabel: string; debitAmount: string; creditAmount: string
  vatRate: string; classificationId: string
}
export const emptyLineDraft: AccountingLineDraft = {
  accountId: '', lineLabel: '', debitAmount: '0', creditAmount: '0', vatRate: '', classificationId: '',
}
export function lineDraft(line?: AccountingEntryLine): AccountingLineDraft {
  return line ? { accountId: line.accountId ? String(line.accountId) : '', lineLabel: line.lineLabel,
    debitAmount: line.debitAmount, creditAmount: line.creditAmount, vatRate: line.vatRate ?? '',
    classificationId: line.classificationId ? String(line.classificationId) : '' } : { ...emptyLineDraft }
}
const amountPattern = /^\d{1,10}(?:\.\d{1,2})?$/
export function lineDraftError(draft: AccountingLineDraft): string | null {
  if (!draft.accountId) return 'Select an active account.'
  if (!draft.lineLabel.trim() || draft.lineLabel.trim().length > 255) return 'The line label must contain 1 to 255 characters.'
  if (![draft.debitAmount, draft.creditAmount].every((value) => amountPattern.test(value.trim()))) return 'Amounts must be non-negative with up to 10 digits and 2 decimals.'
  if (Number(draft.debitAmount) > 0 && Number(draft.creditAmount) > 0) return 'Enter an amount on either the debit or credit side, not both.'
  if (draft.vatRate.trim() && (!/^\d{1,3}(?:\.\d{1,2})?$/.test(draft.vatRate.trim()) || Number(draft.vatRate) > 100)) return 'VAT must be between 0 and 100 with up to 2 decimals.'
  return null
}
export function linePayload(draft: AccountingLineDraft): AccountingEntryLineCorrectionRequest {
  return { accountId: Number(draft.accountId), lineLabel: draft.lineLabel.trim(),
    debitAmount: draft.debitAmount.trim(), creditAmount: draft.creditAmount.trim(),
    vatRate: draft.vatRate.trim() || null, classificationId: draft.classificationId ? Number(draft.classificationId) : null }
}
