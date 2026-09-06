package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.User;

public interface NotificationService {

    Notification create(User recipient, String type, String message, Invoice invoice);

    void notifyOcrFailure(Invoice invoice, OcrError error);

    void notifyCorrectionRequest(Invoice invoice, String reason);

    void notifyRejection(Invoice invoice, String reason);
}
