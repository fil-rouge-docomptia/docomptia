package org.facturation.backend.repository;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    boolean existsByRecipientAndTypeAndMessageAndInvoice(
            User recipient,
            String type,
            String message,
            Invoice invoice
    );
}
