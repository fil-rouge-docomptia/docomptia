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
        response.setEmailRequired(notification.isEmailRequired());
        response.setEmailRecipient(notification.getEmailRecipient());
        response.setEmailSubject(notification.getEmailSubject());
        response.setEmailBody(notification.getEmailBody());
        response.setCreatedAt(notification.getCreatedAt());
        return response;
    }
}
