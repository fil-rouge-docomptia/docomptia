package org.facturation.backend.service.impl;

import jakarta.transaction.Transactional;
import org.facturation.backend.dto.response.InvoiceHistoryItemResponse;
import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.model.InvoiceValidationDecision;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceValidationDecisionRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceHistoryService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class InvoiceHistoryServiceImpl implements InvoiceHistoryService {

    private static final Long DEFAULT_USER_ID = 1L;
    private static final String CORRECTION_ACTION = "FIELD_CORRECTION";
    private static final String CORRECTION_TYPE = "CORRECTION";
    private static final String DUPLICATE_DECISION_TYPE = "DUPLICATE_DECISION";
    private static final String STATUS_CHANGE_TYPE = "STATUS_CHANGE";
    private static final String VALIDATION_DECISION_TYPE = "VALIDATION_DECISION";

    private final AuditLogRepository auditLogRepository;
    private final InvoiceDuplicateAlertRepository duplicateAlertRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;
    private final InvoiceValidationDecisionRepository validationDecisionRepository;
    private final UserRepository userRepository;

    public InvoiceHistoryServiceImpl(
            AuditLogRepository auditLogRepository,
            InvoiceDuplicateAlertRepository duplicateAlertRepository,
            InvoiceRepository invoiceRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository,
            InvoiceValidationDecisionRepository validationDecisionRepository,
            UserRepository userRepository
    ) {
        this.auditLogRepository = auditLogRepository;
        this.duplicateAlertRepository = duplicateAlertRepository;
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
        this.validationDecisionRepository = validationDecisionRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public List<InvoiceHistoryItemResponse> findByInvoiceId(Long invoiceId) {
        User currentUser = userRepository.findById(DEFAULT_USER_ID)
                .orElseThrow(() -> new IllegalStateException("Default user not found"));
        Long organizationId = currentUser.getOrganization().getOrganizationId();

        if (!invoiceRepository.existsByInvoiceIdAndOrganizationOrganizationId(invoiceId, organizationId)) {
            throw new InvoiceNotFoundException(invoiceId);
        }

        List<InvoiceHistoryItemResponse> history = new ArrayList<>();
        invoiceStatusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        invoiceId,
                        organizationId
                )
                .stream()
                .map(this::toStatusHistoryItem)
                .forEach(history::add);
        auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        organizationId,
                        Invoice.class.getSimpleName(),
                        invoiceId,
                        CORRECTION_ACTION
                )
                .stream()
                .map(this::toCorrectionHistoryItem)
                .forEach(history::add);
        duplicateAlertRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdAndDecidedAtIsNotNullOrderByDecidedAtAscDuplicateAlertIdAsc(
                        invoiceId,
                        organizationId
                )
                .stream()
                .map(this::toDuplicateDecisionHistoryItem)
                .forEach(history::add);
        validationDecisionRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByDecidedAtAscInvoiceValidationDecisionIdAsc(
                        invoiceId,
                        organizationId
                )
                .stream()
                .map(this::toValidationDecisionHistoryItem)
                .forEach(history::add);

        history.sort(Comparator.comparing(
                InvoiceHistoryItemResponse::getDate,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));
        return history;
    }

    private InvoiceHistoryItemResponse toStatusHistoryItem(InvoiceStatusHistory history) {
        InvoiceHistoryItemResponse response = new InvoiceHistoryItemResponse();
        response.setType(STATUS_CHANGE_TYPE);
        response.setAction(history.getInvoiceStatus().getCode());
        response.setDate(history.getChangedAt());
        applyAuthor(response, history.getChangedByUser());
        response.setComment(history.getComment());
        return response;
    }

    private InvoiceHistoryItemResponse toCorrectionHistoryItem(AuditLog auditLog) {
        InvoiceHistoryItemResponse response = new InvoiceHistoryItemResponse();
        response.setType(CORRECTION_TYPE);
        response.setAction(auditLog.getAction());
        response.setDate(auditLog.getCreatedAt());
        applyAuthor(response, auditLog.getUser());
        response.setFieldName(extractFieldName(auditLog));
        response.setOldValue(extractValue(auditLog.getOldValue()));
        response.setNewValue(extractValue(auditLog.getNewValue()));
        return response;
    }

    private InvoiceHistoryItemResponse toDuplicateDecisionHistoryItem(InvoiceDuplicateAlert alert) {
        InvoiceHistoryItemResponse response = new InvoiceHistoryItemResponse();
        response.setType(DUPLICATE_DECISION_TYPE);
        response.setAction(alert.getDecision().name());
        response.setDate(alert.getDecidedAt());
        applyAuthor(response, alert.getDecidedByUser());
        response.setComment(alert.getDecisionReason());
        response.setDuplicateAlertId(alert.getDuplicateAlertId());
        return response;
    }

    private InvoiceHistoryItemResponse toValidationDecisionHistoryItem(InvoiceValidationDecision decision) {
        InvoiceHistoryItemResponse response = new InvoiceHistoryItemResponse();
        response.setType(VALIDATION_DECISION_TYPE);
        response.setAction(decision.getDecisionType().name());
        response.setDate(decision.getDecidedAt());
        applyAuthor(response, decision.getDecidedByUser());
        response.setComment(decision.getReason());
        return response;
    }

    private void applyAuthor(InvoiceHistoryItemResponse response, User user) {
        if (user == null) {
            return;
        }
        response.setAuthorId(user.getUserId());
        response.setAuthor((user.getFirstName() + " " + user.getLastName()).trim());
    }

    private String extractFieldName(AuditLog auditLog) {
        String fieldName = extractFieldName(auditLog.getOldValue());
        return fieldName != null ? fieldName : extractFieldName(auditLog.getNewValue());
    }

    private String extractFieldName(String auditValue) {
        int separatorIndex = separatorIndex(auditValue);
        return separatorIndex < 0 ? null : auditValue.substring(0, separatorIndex);
    }

    private String extractValue(String auditValue) {
        int separatorIndex = separatorIndex(auditValue);
        if (separatorIndex < 0) {
            return auditValue;
        }
        String value = auditValue.substring(separatorIndex + 1);
        return "null".equals(value) ? null : value;
    }

    private int separatorIndex(String auditValue) {
        return auditValue == null ? -1 : auditValue.indexOf('=');
    }
}
