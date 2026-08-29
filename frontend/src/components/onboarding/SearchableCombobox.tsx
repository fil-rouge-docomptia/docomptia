import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type ComboboxOption = {
  label: string
  value: string
}

type SearchableComboboxProps = {
  disabled?: boolean
  emptyMessage: string
  id: string
  onValueChange: (value: string) => void
  options: ComboboxOption[]
  placeholder: string
  searchPlaceholder: string
  value: string
}

export function SearchableCombobox({
  disabled,
  emptyMessage,
  id,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="h-11 w-full justify-between font-normal md:h-9"
          disabled={disabled}
          id={id}
          role="combobox"
          variant="outline"
        >
          <span className="truncate">{selectedOption?.label ?? placeholder}</span>
          <ChevronsUpDown aria-hidden="true" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                  }}
                  value={`${option.label} ${option.value}`}
                >
                  <Check
                    aria-hidden="true"
                    className={cn('opacity-0', value === option.value && 'opacity-100')}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
