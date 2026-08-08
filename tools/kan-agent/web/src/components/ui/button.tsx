import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16827a]/30 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[#0a2631] text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#123b47] hover:shadow-md',
        secondary: 'border border-[#cad5d2] bg-white text-[#17343d] hover:-translate-y-0.5 hover:bg-[#f0f5f2]',
        ghost: 'text-[#53676b] hover:bg-[#eaf1ee] hover:text-[#0a2631]',
        destructive: 'bg-[#a43b35] text-white hover:bg-[#8f2f2a]',
        outline: 'border border-[#cad5d2] bg-transparent text-[#17343d] hover:bg-white',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 px-5',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
