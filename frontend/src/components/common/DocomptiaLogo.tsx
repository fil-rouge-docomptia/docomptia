import { cn } from '@/lib/utils'

type DocomptiaLogoProps = {
  className?: string
  variant?: 'large' | 'square'
}

export function DocomptiaLogo({ className, variant = 'large' }: DocomptiaLogoProps) {
  const isSquare = variant === 'square'

  return (
    <img
      alt="Docomptia"
      className={cn('block h-auto max-w-full object-contain', className)}
      height={isSquare ? 1186 : 226}
      src={isSquare ? '/docomptia-logo-square.png' : '/docomptia-logo-large.png'}
      width={isSquare ? 1186 : 1024}
    />
  )
}
