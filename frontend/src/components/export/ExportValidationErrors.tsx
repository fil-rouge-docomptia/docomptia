import { Link } from 'react-router-dom'
import type { ExportInvoiceErrors } from '@/types/export'

export function ExportValidationErrors({ invoices }: { invoices: ExportInvoiceErrors[] }) {
  if (invoices.length === 0) return null
  return <div aria-label="Accounting control errors" className="mt-4 space-y-3">
    {invoices.map((invoice, index) => <section className="min-w-0 rounded-md border border-destructive/30 p-3" key={invoice.invoiceId ?? `selection-${index}`}>
      <h3 className="break-words font-medium">{invoice.invoiceId ? <Link className="underline underline-offset-4" to={`/invoices/${invoice.invoiceId}`}>{invoice.invoiceNumber || `Invoice #${invoice.invoiceId}`}</Link> : 'Selection'}</h3>
      <ul className="mt-2 space-y-2 text-sm">{invoice.errors.map((error, index) => <li className="break-words" key={`${error.code}-${index}`}><span className="block text-xs font-medium">{error.code.replaceAll('_', ' ').toLowerCase()}</span>{error.message}</li>)}</ul>
    </section>)}
  </div>
}
