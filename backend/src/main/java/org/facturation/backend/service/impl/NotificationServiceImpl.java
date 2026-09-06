package org.facturation.backend.service.impl;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.NotificationRepository;
import org.facturation.backend.service.NotificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final String OCR_ERROR_TYPE = "OCR_ERROR";
    private static final String CORRECTION_REQUEST_TYPE = "CORRECTION_REQUEST";
    private static final String REJECTION_TYPE = "REJECTION";

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

    @Override
    @Transactional
    public void notifyOcrFailure(Invoice invoice, OcrError error) {
        User recipient = invoice.getCreatedByUser();
        String message = "Invoice " + invoice.getInvoiceId() + " could not be analyzed: "
                + error.getErrorCode() + " - " + error.getErrorMessage();
        if (notificationRepository.existsByRecipientAndTypeAndMessageAndInvoice(
                recipient, OCR_ERROR_TYPE, message, invoice
        )) {
            return;
        }
        create(recipient, OCR_ERROR_TYPE, message, invoice);
    }

    @Override
    @Transactional
    public void notifyCorrectionRequest(Invoice invoice, String reason) {
        notifyDepositor(
                invoice,
                CORRECTION_REQUEST_TYPE,
                "Correction requested for invoice " + invoice.getInvoiceId() + ": ",
                reason
        );
    }

    @Override
    @Transactional
    public void notifyRejection(Invoice invoice, String reason) {
        notifyDepositor(invoice, REJECTION_TYPE, "Invoice " + invoice.getInvoiceId() + " rejected: ", reason);
    }

    private void notifyDepositor(Invoice invoice, String type, String messagePrefix, String reason) {
        String message = messagePrefix + requireValue(reason, "decision reason");
        create(invoice.getCreatedByUser(), type, message, invoice);
    }

    private String requireValue(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Notification " + fieldName + " is required");
        }
        return value.trim();
    }
}
