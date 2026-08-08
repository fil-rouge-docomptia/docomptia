import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={cn('relative flex gap-3 rounded-xl border border-[#d7dfdc] bg-[#f7f9f6] p-4 text-sm text-[#29464d] [&>svg]:mt-0.5 [&>svg]:shrink-0', className)} {...props} />
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-semibold leading-none', className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm leading-relaxed text-[#68777b]', className)} {...props} />
}
