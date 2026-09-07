import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ApiError } from '@/services/api'
import { listNotifications, markNotificationAsRead } from '@/services/notification'
import type { UserNotification } from '@/types/notification'

export type NotificationLoadError = 'forbidden' | 'generic' | null

const NOTIFICATION_PAGE_SIZE = 20

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getLoadError(error: unknown): NotificationLoadError {
  return error instanceof ApiError && error.status === 403 ? 'forbidden' : 'generic'
}

export function useNotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[] | null>(null)
  const [totalNotifications, setTotalNotifications] = useState(0)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<NotificationLoadError>(null)
  const [pendingReadIds, setPendingReadIds] = useState<number[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const unreadRequestId = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const requestId = unreadRequestId.current + 1
    unreadRequestId.current = requestId

    listNotifications(
      { page: 0, size: 1, unreadOnly: true },
      controller.signal,
    )
      .then((page) => {
        if (unreadRequestId.current === requestId) {
          setUnreadCount(page.totalElements)
        }
      })
      .catch((error: unknown) => {
        if (!isAbortError(error) && unreadRequestId.current === requestId) {
          setUnreadCount(null)
        }
      })

    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    if (!open) {
      return
    }

    const controller = new AbortController()

    listNotifications(
      { page: 0, size: NOTIFICATION_PAGE_SIZE, unreadOnly: false },
      controller.signal,
    )
      .then((page) => {
        setNotifications(page.content)
        setTotalNotifications(page.totalElements)
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setLoadError(getLoadError(error))
          setNotifications([])
        }
      })

    return () => controller.abort()
  }, [open, refreshKey])

  const markAsRead = useCallback(async (notification: UserNotification) => {
    if (notification.read || pendingReadIds.includes(notification.notificationId)) {
      return
    }

    setPendingReadIds((currentIds) => [...currentIds, notification.notificationId])
    unreadRequestId.current += 1
    setNotifications((currentNotifications) => currentNotifications?.map((currentNotification) =>
      currentNotification.notificationId === notification.notificationId
        ? { ...currentNotification, read: true }
        : currentNotification,
    ) ?? null)
    setUnreadCount((currentCount) =>
      currentCount === null ? null : Math.max(0, currentCount - 1),
    )

    try {
      const updatedNotification = await markNotificationAsRead(notification.notificationId)
      setNotifications((currentNotifications) => currentNotifications?.map((currentNotification) =>
        currentNotification.notificationId === updatedNotification.notificationId
          ? updatedNotification
          : currentNotification,
      ) ?? null)

      try {
        const requestId = unreadRequestId.current + 1
        unreadRequestId.current = requestId
        const unreadPage = await listNotifications({ page: 0, size: 1, unreadOnly: true })
        if (unreadRequestId.current === requestId) {
          setUnreadCount(unreadPage.totalElements)
        }
      } catch {
        // Keep the optimistic count when the background refresh is unavailable.
      }
    } catch {
      setNotifications((currentNotifications) => currentNotifications?.map((currentNotification) =>
        currentNotification.notificationId === notification.notificationId
          ? notification
          : currentNotification,
      ) ?? null)
      setUnreadCount((currentCount) => currentCount === null ? null : currentCount + 1)
      toast.error('Unable to mark this notification as read.')
    } finally {
      setPendingReadIds((currentIds) =>
        currentIds.filter((notificationId) => notificationId !== notification.notificationId),
      )
    }
  }, [pendingReadIds])

  const changeOpen = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setLoadError(null)
      setNotifications(null)
    }
    setOpen(nextOpen)
  }, [])

  const retry = useCallback(() => {
    setLoadError(null)
    setNotifications(null)
    setRefreshKey((currentKey) => currentKey + 1)
  }, [])

  return {
    loadError,
    markAsRead,
    notifications,
    open,
    pendingReadIds,
    retry,
    setOpen: changeOpen,
    totalNotifications,
    unreadCount,
  }
}
