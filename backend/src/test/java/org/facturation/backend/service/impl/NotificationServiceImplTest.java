package org.facturation.backend.service.impl;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceImplTest {

    private NotificationRepository notificationRepository;
    private NotificationServiceImpl notificationService;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        notificationService = new NotificationServiceImpl(notificationRepository);
    }

    @Test
    void createsUnreadNotificationWithRecipientDateAndInvoice() {
        User recipient = new User();
        Invoice invoice = new Invoice();
        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        when(notificationRepository.save(notificationCaptor.capture()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        LocalDateTime beforeCreation = LocalDateTime.now();

        Notification notification = notificationService.create(
                recipient,
                "  INVOICE_ASSIGNED  ",
                "  An invoice requires your attention.  ",
                invoice
        );

        assertThat(notification).isSameAs(notificationCaptor.getValue());
        assertThat(notification.getRecipient()).isSameAs(recipient);
        assertThat(notification.getType()).isEqualTo("INVOICE_ASSIGNED");
        assertThat(notification.getMessage()).isEqualTo("An invoice requires your attention.");
        assertThat(notification.getInvoice()).isSameAs(invoice);
        assertThat(notification.isRead()).isFalse();
        assertThat(notification.getCreatedAt()).isBetween(beforeCreation, LocalDateTime.now());
    }

    @Test
    void createsNotificationWithoutInvoice() {
        User recipient = new User();
        when(notificationRepository.save(org.mockito.ArgumentMatchers.any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Notification notification = notificationService.create(
                recipient,
                "ACCOUNT_UPDATED",
                "Your account was updated.",
                null
        );

        assertThat(notification.getInvoice()).isNull();
    }

    @Test
    void rejectsMissingRecipientTypeOrMessage() {
        User recipient = new User();

        assertThatIllegalArgumentException()
                .isThrownBy(() -> notificationService.create(null, "TYPE", "Message", null))
                .withMessage("Notification recipient is required");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> notificationService.create(recipient, "  ", "Message", null))
                .withMessage("Notification type is required");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> notificationService.create(recipient, "TYPE", null, null))
                .withMessage("Notification message is required");

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any(Notification.class));
    }
}
