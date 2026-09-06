package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.NotificationResponse;
import org.facturation.backend.model.Notification;
import org.springframework.stereotype.Component;

@Component
public class NotificationResponseMapper {

    public NotificationResponse toResponse(Notification notification) {
        NotificationResponse response = new NotificationResponse();
        response.setNotificationId(notification.getNotificationId());
        response.setType(notification.getType());
        response.setMessage(notification.getMessage());
        response.setInvoiceId(notification.getInvoice() == null ? null : notification.getInvoice().getInvoiceId());
        response.setRead(notification.isRead());
        response.setReadAt(notification.getReadAt());
        response.setCreatedAt(notification.getCreatedAt());
        return response;
    }
}
