import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AccountImportInspection, AccountImportMapping } from '@/types/account-import'

const fields: { key: keyof AccountImportMapping, label: string }[] = [
  { key: 'accountNumber', label: 'Account number (required)' },
  { key: 'accountLabel', label: 'Account label (required)' },
  { key: 'accountType', label: 'Account type (required)' },
  { key: 'active', label: 'Active status (optional)' },
]

export function AccountImportColumns({ inspection, mapping, disabled, onChange }: {
  inspection: AccountImportInspection
  mapping: AccountImportMapping
  disabled: boolean
  onChange: (mapping: AccountImportMapping) => void
}) {
  function assign(index: number, value: string) {
    const next = { ...mapping }
    for (const { key } of fields) if (next[key] === index) next[key] = null
    const field = fields.find(({ key }) => key === value)
    if (field) next[field.key] = index
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div><h3 className="text-base font-semibold">Map CSV columns</h3><p className="mt-2 text-sm text-muted-foreground">Match each detected CSV column to a Docomptia account field.</p></div>
      <div>
        {inspection.columns.map((column, index) => (
          <div className="flex min-w-0 flex-col gap-3 border-t py-3 sm:flex-row sm:items-center sm:justify-between" key={index}>
            <div className="min-w-0 flex-1">
              <Label className="break-all text-sm" htmlFor={`csv-column-${index}`}>{column}</Label>
              <p className="mt-1 break-all text-xs text-muted-foreground">Example: {inspection.sampleRows[0]?.[index]?.slice(0, 100) || 'Empty'}</p>
            </div>
            <Select disabled={disabled} onValueChange={(value) => assign(index, value)} value={fields.find(({ key }) => mapping[key] === index)?.key ?? 'ignore'}>
              <SelectTrigger className="w-full shrink-0 sm:w-80" id={`csv-column-${index}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ignore">Ignore column</SelectItem>
                {fields.map(({ key, label }) => <SelectItem disabled={mapping[key] !== null && mapping[key] !== index} key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Map account number, label and type before continuing. Each field can be assigned once. If active status is not mapped, all imported accounts will be active.</p>
    </div>
  )
}
