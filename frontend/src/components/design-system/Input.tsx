import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-lg border border-[#72787c] bg-white px-4 py-2 text-base text-[#0b1c30] transition-colors outline-none placeholder:text-slate-500 focus-visible:border-[#083344] focus-visible:ring-2 focus-visible:ring-[#083344]/20',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
