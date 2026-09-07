import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

type PageItem = number | 'ellipsis'

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, 'ellipsis', currentPage, 'ellipsis', totalPages]
}

type SupplierPaginationProps = {
  ariaLabel?: string
  currentPage: number
  itemLabel?: string
  onPageChange: (page: number) => void
  pageSize: number
  totalElements: number
  totalPages: number
}

export function SupplierPagination({
  ariaLabel = 'Supplier pagination',
  currentPage,
  itemLabel = 'suppliers',
  onPageChange,
  pageSize,
  totalElements,
  totalPages,
}: SupplierPaginationProps) {
  const firstItem = totalElements === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalElements)

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-muted-foreground">
        {firstItem}–{lastItem} of {totalElements} {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <Button
          aria-label="Previous page"
          className="h-10 px-3"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {getPageItems(currentPage, totalPages).map((item, index) => (
          item === 'ellipsis' ? (
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center text-xs text-muted-foreground"
              key={`ellipsis-${index}`}
            >
              …
            </span>
          ) : (
            <Button
              aria-current={item === currentPage ? 'page' : undefined}
              aria-label={`Page ${item}`}
              className="size-10 p-0 text-xs"
              key={item}
              onClick={() => onPageChange(item)}
              size="sm"
              type="button"
              variant={item === currentPage ? 'default' : 'outline'}
            >
              {item}
            </Button>
          )
        ))}

        <Button
          aria-label="Next page"
          className="h-10 px-3"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
