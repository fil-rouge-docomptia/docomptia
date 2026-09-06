package org.facturation.backend.service.impl;

import org.facturation.backend.mapper.NotificationResponseMapper;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.NotificationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.CurrentUserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceImplTest {

    private NotificationRepository notificationRepository;
    private UserRepository userRepository;
    private CurrentUserService currentUserService;
    private NotificationServiceImpl notificationService;

    @BeforeEach
    void setUp() {
        notificationRepository = mock(NotificationRepository.class);
        userRepository = mock(UserRepository.class);
        currentUserService = mock(CurrentUserService.class);
        notificationService = new NotificationServiceImpl(
                notificationRepository,
                userRepository,
                currentUserService,
                new NotificationResponseMapper()
        );
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
        assertThat(notification.isEmailRequired()).isFalse();
        assertThat(notification.getEmailRecipient()).isNull();
        assertThat(notification.getEmailSubject()).isNull();
        assertThat(notification.getEmailBody()).isNull();
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

    @Test
    void notifiesTheInvoiceDepositorAboutAnOcrFailure() {
        User depositor = new User();
        depositor.setEmail("depositor@example.com");
        Invoice invoice = invoice(42L, depositor);
        OcrError error = ocrError("OCR_SERVICE_UNAVAILABLE", "OCR service is unavailable");
        when(notificationRepository.save(org.mockito.ArgumentMatchers.any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        notificationService.notifyOcrFailure(invoice, error);

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertThat(notification.getRecipient()).isSameAs(depositor);
        assertThat(notification.getInvoice()).isSameAs(invoice);
        assertThat(notification.getType()).isEqualTo("OCR_ERROR");
        assertThat(notification.getMessage())
                .isEqualTo("Invoice 42 could not be analyzed: OCR_SERVICE_UNAVAILABLE - OCR service is unavailable");
        assertThat(notification.isEmailRequired()).isTrue();
        assertThat(notification.getEmailRecipient()).isEqualTo("depositor@example.com");
        assertThat(notification.getEmailSubject()).isEqualTo("Invoice analysis failed");
        assertThat(notification.getEmailBody()).isEqualTo(notification.getMessage());
    }

    @Test
    void keepsInternalNotificationWhenRecipientHasNoEmail() {
        User depositor = new User();
        Invoice invoice = invoice(42L, depositor);
        OcrError error = ocrError("OCR_SERVICE_UNAVAILABLE", "OCR service is unavailable");
        when(notificationRepository.save(org.mockito.ArgumentMatchers.any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        notificationService.notifyOcrFailure(invoice, error);

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertThat(notification.getRecipient()).isSameAs(depositor);
        assertThat(notification.isEmailRequired()).isFalse();
        assertThat(notification.getEmailRecipient()).isNull();
        assertThat(notification.getEmailSubject()).isNull();
        assertThat(notification.getEmailBody()).isNull();
    }

    @Test
    void doesNotDuplicateTheSameOcrFailureNotification() {
        User depositor = new User();
        Invoice invoice = invoice(42L, depositor);
        OcrError error = ocrError("OCR_SERVICE_UNAVAILABLE", "OCR service is unavailable");
        String message = "Invoice 42 could not be analyzed: OCR_SERVICE_UNAVAILABLE - OCR service is unavailable";
        when(notificationRepository.existsByRecipientAndTypeAndMessageAndInvoice(
                depositor, "OCR_ERROR", message, invoice
        )).thenReturn(true);

        notificationService.notifyOcrFailure(invoice, error);

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any(Notification.class));
    }

    @Test
    void notifiesTheInvoiceDepositorAboutACorrectionRequest() {
        User depositor = new User();
        Invoice invoice = invoice(42L, depositor);
        when(notificationRepository.save(org.mockito.ArgumentMatchers.any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        notificationService.notifyCorrectionRequest(invoice, "  The total amount must be checked  ");

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertThat(notification.getRecipient()).isSameAs(depositor);
        assertThat(notification.getInvoice()).isSameAs(invoice);
        assertThat(notification.getType()).isEqualTo("CORRECTION_REQUEST");
        assertThat(notification.getMessage())
                .isEqualTo("Correction requested for invoice 42: The total amount must be checked");
    }

    @Test
    void notifiesTheInvoiceDepositorAboutARejection() {
        User depositor = new User();
        Invoice invoice = invoice(42L, depositor);
        when(notificationRepository.save(org.mockito.ArgumentMatchers.any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        notificationService.notifyRejection(invoice, "  The invoice is not compliant  ");

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(notificationCaptor.capture());
        Notification notification = notificationCaptor.getValue();
        assertThat(notification.getRecipient()).isSameAs(depositor);
        assertThat(notification.getInvoice()).isSameAs(invoice);
        assertThat(notification.getType()).isEqualTo("REJECTION");
        assertThat(notification.getMessage())
                .isEqualTo("Invoice 42 rejected: The invoice is not compliant");
    }

    @Test
    void notifiesActiveAccountingManagersAboutPendingValidation() {
        User firstValidator = new User();
        firstValidator.setEmail("first-validator@example.com");
        User secondValidator = new User();
        secondValidator.setEmail("second-validator@example.com");
        Invoice invoice = invoice(42L, new User());
        Organization organization = new Organization();
        organization.setOrganizationId(7L);
        invoice.setOrganization(organization);
        when(userRepository.findActiveUsersByOrganizationAndRole(7L, "RESPONSABLE_COMPTABLE"))
                .thenReturn(List.of(firstValidator, secondValidator));
        when(notificationRepository.save(org.mockito.ArgumentMatchers.any(Notification.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        notificationService.notifyPendingValidation(invoice);

        ArgumentCaptor<Notification> notificationCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository, org.mockito.Mockito.times(2)).save(notificationCaptor.capture());
        assertThat(notificationCaptor.getAllValues())
                .extracting(Notification::getRecipient)
                .containsExactly(firstValidator, secondValidator);
        assertThat(notificationCaptor.getAllValues())
                .allSatisfy(notification -> {
                    assertThat(notification.getInvoice()).isSameAs(invoice);
                    assertThat(notification.getType()).isEqualTo("PENDING_VALIDATION");
                    assertThat(notification.getMessage()).isEqualTo("Invoice 42 is awaiting validation");
                    assertThat(notification.isEmailRequired()).isTrue();
                    assertThat(notification.getEmailSubject()).isEqualTo("Invoice awaiting validation");
                    assertThat(notification.getEmailBody()).isEqualTo(notification.getMessage());
                });
    }

    @Test
    void doesNotDuplicatePendingValidationNotification() {
        User validator = new User();
        Invoice invoice = invoice(42L, new User());
        Organization organization = new Organization();
        organization.setOrganizationId(7L);
        invoice.setOrganization(organization);
        String message = "Invoice 42 is awaiting validation";
        when(userRepository.findActiveUsersByOrganizationAndRole(7L, "RESPONSABLE_COMPTABLE"))
                .thenReturn(List.of(validator));
        when(notificationRepository.existsByRecipientAndTypeAndMessageAndInvoice(
                validator, "PENDING_VALIDATION", message, invoice
        )).thenReturn(true);

        notificationService.notifyPendingValidation(invoice);

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any(Notification.class));
    }

    private Invoice invoice(Long invoiceId, User depositor) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceId(invoiceId);
        invoice.setCreatedByUser(depositor);
        return invoice;
    }

    private OcrError ocrError(String code, String message) {
        OcrError error = new OcrError();
        error.setErrorCode(code);
        error.setErrorMessage(message);
        return error;
    }
}
