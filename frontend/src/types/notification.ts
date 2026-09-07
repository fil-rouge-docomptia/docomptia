export type UserNotification = {
  notificationId: number
  type: string
  message: string
  invoiceId: number | null
  read: boolean
  readAt: string | null
  createdAt: string
}

export type NotificationPage = {
  content: UserNotification[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}
