import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#9cf2e8] text-[#00201d]',
        secondary: 'border-slate-200 bg-slate-100 text-slate-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
