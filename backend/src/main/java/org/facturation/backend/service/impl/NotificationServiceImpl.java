package org.facturation.backend.service.impl;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.NotificationRepository;
import org.facturation.backend.service.NotificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationServiceImpl(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Override
    @Transactional
    public Notification create(User recipient, String type, String message, Invoice invoice) {
        if (recipient == null) {
            throw new IllegalArgumentException("Notification recipient is required");
        }

        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setType(requireValue(type, "type"));
        notification.setMessage(requireValue(message, "message"));
        notification.setInvoice(invoice);
        notification.setRead(false);
        notification.setCreatedAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }

    private String requireValue(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Notification " + fieldName + " is required");
        }
        return value.trim();
    }
}
