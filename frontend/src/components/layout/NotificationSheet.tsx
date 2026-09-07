import { AlertCircle, Bell, BellOff, LoaderCircle, ReceiptText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { NotificationLoadError } from '@/hooks/use-notification-center'
import type { UserNotification } from '@/types/notification'

type NotificationSheetProps = {
  loadError: NotificationLoadError
  notifications: UserNotification[] | null
  onMarkAsRead: (notification: UserNotification) => Promise<void>
  onOpenChange: (open: boolean) => void
  onRetry: () => void
  open: boolean
  pendingReadIds: number[]
  totalNotifications: number
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const notificationTitles: Record<string, string> = {
  CORRECTION_REQUEST: 'Correction requested',
  INVOICE_REJECTED: 'Invoice rejected',
  OCR_ERROR: 'Invoice processing failed',
  PENDING_VALIDATION: 'Invoice ready for review',
  REJECTION: 'Invoice rejected',
}

function formatNotificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function getNotificationTitle(type: string) {
  return notificationTitles[type] ?? 'Notification'
}

function NotificationLoadingState() {
  return (
    <div aria-label="Loading notifications" className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="rounded-lg border p-4" key={index}>
          <div className="flex gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function NotificationSheet({
  loadError,
  notifications,
  onMarkAsRead,
  onOpenChange,
  onRetry,
  open,
  pendingReadIds,
  totalNotifications,
}: NotificationSheetProps) {
  const navigate = useNavigate()

  const selectNotification = (notification: UserNotification) => {
    void onMarkAsRead(notification)

    if (notification.invoiceId !== null) {
      onOpenChange(false)
      navigate(`/invoices/${notification.invoiceId}`)
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full max-w-none flex-col gap-0 p-0 sm:w-[26rem] sm:max-w-[26rem]">
        <SheetHeader className="border-b px-6 pb-5 pt-6 text-left">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Your latest invoice workflow updates.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {notifications === null ? (
            <NotificationLoadingState />
          ) : loadError ? (
            <div
              className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center"
              role="alert"
            >
              <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
              <p className="mt-3 font-medium text-foreground">
                {loadError === 'forbidden'
                  ? 'Notifications are not available for your access.'
                  : 'Notifications are temporarily unavailable.'}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {loadError === 'forbidden'
                  ? 'Ask a workspace administrator if you need access to workflow notifications.'
                  : 'Try loading your notifications again.'}
              </p>
              {loadError === 'generic' ? (
                <Button className="mt-4" onClick={onRetry} size="sm" type="button" variant="outline">
                  Try again
                </Button>
              ) : null}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-5 text-center">
              <BellOff aria-hidden="true" className="size-6 text-muted-foreground" />
              <p className="mt-3 font-medium text-foreground">No notifications yet</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Invoice processing and approval updates will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const pending = pendingReadIds.includes(notification.notificationId)
                const title = getNotificationTitle(notification.type)

                return (
                  <button
                    aria-label={`${notification.read ? 'Read' : 'Unread'} notification — ${title}: ${notification.message}`}
                    className="flex w-full gap-3 rounded-lg border p-4 text-left shadow-elevation-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    key={notification.notificationId}
                    onClick={() => selectNotification(notification)}
                    type="button"
                  >
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      {notification.invoiceId === null ? (
                        <Bell aria-hidden="true" className="size-4" />
                      ) : (
                        <ReceiptText aria-hidden="true" className="size-4" />
                      )}
                      {!notification.read ? (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-destructive" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-medium text-foreground">{title}</span>
                        {pending ? (
                          <LoaderCircle
                            aria-label="Marking notification as read"
                            className="size-4 shrink-0 animate-spin text-muted-foreground"
                          />
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                        {notification.message}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {formatNotificationDate(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {notifications && notifications.length > 0 ? (
          <p className="border-t px-6 py-3 text-center text-xs text-muted-foreground">
            Showing {notifications.length} of {totalNotifications} notifications
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
