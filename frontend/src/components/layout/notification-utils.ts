export function getNotificationButtonLabel(unreadCount: number | null) {
  if (!unreadCount) {
    return 'Notifications'
  }

  return `Notifications, ${unreadCount} unread`
}

export function getNotificationBadgeText(unreadCount: number) {
  return unreadCount > 99 ? '99+' : String(unreadCount)
}
