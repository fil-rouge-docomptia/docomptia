package org.facturation.backend.service;

import org.facturation.backend.dto.response.NotificationResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface NotificationService {

    Page<NotificationResponse> getCurrentUserNotifications(boolean unreadOnly, Pageable pageable);

    Notification create(User recipient, String type, String message, Invoice invoice);

    void notifyOcrFailure(Invoice invoice, OcrError error);

    void notifyCorrectionRequest(Invoice invoice, String reason);

    void notifyRejection(Invoice invoice, String reason);

    void notifyPendingValidation(Invoice invoice);
}
