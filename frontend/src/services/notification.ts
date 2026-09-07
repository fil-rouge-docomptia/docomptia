import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { NotificationPage, UserNotification } from '@/types/notification'

type NotificationListQuery = {
  page: number
  size: number
  unreadOnly: boolean
}

export async function listNotifications(
  query: NotificationListQuery,
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
    unreadOnly: String(query.unreadOnly),
  })
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/notifications?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<NotificationPage>
}

export async function markNotificationAsRead(
  notificationId: number,
): Promise<UserNotification> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/notifications/${notificationId}/read`,
    { method: 'PATCH' },
  )

  return response.json() as Promise<UserNotification>
}
