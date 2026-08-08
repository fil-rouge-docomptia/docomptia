import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#071d25]/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        className={cn('fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-[#d7dfdc] bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-[#718083] transition hover:bg-[#edf3f0] hover:text-[#0a2631]">
          <X className="size-4" /><span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 text-left', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-xl font-semibold tracking-tight text-[#0a2631]', className)} {...props} />
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm leading-relaxed text-[#68777b]', className)} {...props} />
}
