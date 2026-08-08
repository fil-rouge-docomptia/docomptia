import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#dcefeb] text-[#126d67]',
        secondary: 'border-[#d7dfdc] bg-[#f3f6f3] text-[#5e6d70]',
        warning: 'border-transparent bg-[#ffe6da] text-[#a34a27]',
        destructive: 'border-transparent bg-[#f8dcda] text-[#a43b35]',
        success: 'border-transparent bg-[#dcefe1] text-[#2e7146]',
        outline: 'border-[#cad5d2] bg-transparent text-[#53676b]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type Props = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: Props) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
