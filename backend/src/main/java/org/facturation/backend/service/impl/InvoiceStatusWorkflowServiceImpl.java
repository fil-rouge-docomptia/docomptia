package org.facturation.backend.service.impl;

import org.facturation.backend.exception.InvoiceMissingRequiredFieldsException;
import org.facturation.backend.exception.InvoiceStatusTransitionException;
import org.facturation.backend.exception.OcrRetryNotAllowedException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.model.InvoiceValidationDecisionType;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.InvoiceValidationDecisionService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class InvoiceStatusWorkflowServiceImpl implements InvoiceStatusWorkflowService {

    private static final Map<InvoiceStatusCode, Set<InvoiceStatusCode>> ALLOWED_PREVIOUS_STATUSES =
            buildAllowedPreviousStatuses();

    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;
    private final InvoiceValidationDecisionService validationDecisionService;

    public InvoiceStatusWorkflowServiceImpl(
            InvoiceRepository invoiceRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository,
            InvoiceValidationDecisionService validationDecisionService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
        this.validationDecisionService = validationDecisionService;
    }

    @Override
    public InvoiceStatus findByCode(InvoiceStatusCode code) {
        return findByCode(code.getCode());
    }

    @Override
    public InvoiceStatus findByCode(String code) {
        return invoiceStatusRepository.findByCode(code)
                .orElseThrow(() -> new IllegalStateException("Invoice status " + code + " not found"));
    }

    @Override
    public void recordUpload(Invoice invoice, User user) {
        saveStatusHistory(invoice, invoice.getInvoiceStatus(), user, "Invoice uploaded");
    }

    @Override
    public void startOcrAnalysis(Invoice invoice, User user) {
        transitionTo(invoice, InvoiceStatusCode.OCR_EN_COURS, user, "OCR analysis started");
    }

    @Override
    public void ensureCanRetryOcr(Invoice invoice) {
        if (getCurrentStatusCode(invoice) != InvoiceStatusCode.ERREUR_OCR) {
            throw new OcrRetryNotAllowedException(invoice.getInvoiceId());
        }
    }

    @Override
    public void restartOcrAnalysis(Invoice invoice, User user) {
        ensureCanRetryOcr(invoice);
        updateStatus(invoice, findByCode(InvoiceStatusCode.OCR_EN_COURS), user, "OCR retry started");
    }

    @Override
    public void markOcrFailure(Invoice invoice, User user) {
        transitionTo(invoice, InvoiceStatusCode.ERREUR_OCR, user, "OCR analysis failed");
    }

    @Override
    public void completeOcrAnalysis(Invoice invoice, User user) {
        transitionTo(invoice, InvoiceStatusCode.EXTRAITE, user, "OCR analysis completed");
    }

    @Override
    public void ensureCanCorrect(Invoice invoice, boolean hasCorrections) {
        if (!hasCorrections) {
            return;
        }

        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        switch (currentCode) {
            case EXTRAITE, A_VERIFIER, ERREUR_OCR, REJETEE -> {
                return;
            }
            default -> throw InvoiceStatusTransitionException.forAction(
                    invoice.getInvoiceId(),
                    currentCode.getCode(),
                    "be corrected"
            );
        }
    }

    @Override
    public void reintegrateAfterCorrectionIfNeeded(Invoice invoice, User user, boolean hasCorrections) {
        if (!hasCorrections) {
            return;
        }

        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        if (currentCode == InvoiceStatusCode.ERREUR_OCR) {
            transitionTo(invoice, InvoiceStatusCode.A_VERIFIER, user, "Invoice corrected and ready for review");
        } else if (currentCode == InvoiceStatusCode.REJETEE) {
            transitionTo(invoice, InvoiceStatusCode.EXTRAITE, user, "Rejected invoice corrected and ready for submission");
        }
    }

    @Override
    public void submitForValidation(Invoice invoice, User user) {
        ensureCurrentStatus(invoice, InvoiceStatusCode.EXTRAITE, "be submitted for validation");
        ensureRequiredFields(invoice, "be submitted for validation");
        transitionTo(invoice, InvoiceStatusCode.A_VERIFIER, user, "Invoice submitted for validation");
    }

    @Override
    public void validateInvoice(Invoice invoice, User user) {
        ensureCurrentStatus(invoice, InvoiceStatusCode.A_VERIFIER, "be validated");
        ensureRequiredFields(invoice, "be validated");
        transitionTo(invoice, InvoiceStatusCode.VALIDEE, user, "Invoice validated");
        validationDecisionService.record(invoice, InvoiceValidationDecisionType.VALIDATION, user, null);
    }

    @Override
    public void requestInvoiceCorrection(Invoice invoice, User user, String reason) {
        String correctionReason = requireReason(reason, "Correction request reason is required");
        ensureCurrentStatus(invoice, InvoiceStatusCode.A_VERIFIER, "receive a correction request");
        transitionTo(invoice, InvoiceStatusCode.EXTRAITE, user, correctionReason);
        validationDecisionService.record(
                invoice, InvoiceValidationDecisionType.CORRECTION_REQUEST, user, correctionReason
        );
    }

    @Override
    public void rejectInvoice(Invoice invoice, User user, String reason) {
        String rejectionReason = requireReason(reason, "Rejection reason is required");
        ensureStatusChangeRequested(invoice, InvoiceStatusCode.REJETEE, "be rejected");
        ensureCurrentStatus(invoice, InvoiceStatusCode.A_VERIFIER, "be rejected");
        transitionTo(invoice, InvoiceStatusCode.REJETEE, user, rejectionReason);
        validationDecisionService.record(invoice, InvoiceValidationDecisionType.REJECTION, user, rejectionReason);
    }

    @Override
    public void rejectInvoiceAsDuplicate(Invoice invoice, User user, String reason) {
        String rejectionReason = requireReason(reason, "Rejection reason is required");
        ensureStatusChangeRequested(invoice, InvoiceStatusCode.REJETEE, "be rejected as a duplicate");
        transitionTo(invoice, InvoiceStatusCode.REJETEE, user, rejectionReason);
    }

    @Override
    public void ensureCanGenerateAccountingEntry(Invoice invoice) {
        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        if (currentCode != InvoiceStatusCode.VALIDEE) {
            throw InvoiceStatusTransitionException.forAction(
                    invoice.getInvoiceId(),
                    currentCode.getCode(),
                    "generate an accounting entry; expected step: validate the invoice"
            );
        }
    }

    @Override
    public void markExportable(Invoice invoice, User user) {
        transitionTo(
                invoice,
                InvoiceStatusCode.EXPORTABLE,
                user,
                "Accounting entry generated and invoice marked exportable"
        );
    }

    @Override
    public void markAccountingEntryToCorrect(Invoice invoice, User user) {
        transitionTo(
                invoice,
                InvoiceStatusCode.VALIDEE,
                user,
                "Accounting entry unbalanced and returned for correction"
        );
    }

    @Override
    public void ensureCanTransition(Invoice invoice, InvoiceStatusCode targetCode) {
        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        if (currentCode == targetCode) {
            return;
        }

        Set<InvoiceStatusCode> allowedPreviousStatuses = ALLOWED_PREVIOUS_STATUSES.get(targetCode);
        if (allowedPreviousStatuses == null || !allowedPreviousStatuses.contains(currentCode)) {
            throw new InvoiceStatusTransitionException(
                    invoice.getInvoiceId(),
                    currentCode.getCode(),
                    targetCode.getCode()
            );
        }
    }

    @Override
    public void transitionTo(Invoice invoice, InvoiceStatusCode targetCode, User user, String comment) {
        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        if (currentCode == targetCode) {
            return;
        }
        ensureCanTransition(invoice, targetCode);
        updateStatus(invoice, findByCode(targetCode), user, comment);
    }

    private void ensureStatusChangeRequested(Invoice invoice, InvoiceStatusCode targetCode, String action) {
        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        if (currentCode == targetCode) {
            throw InvoiceStatusTransitionException.forAction(
                    invoice.getInvoiceId(),
                    currentCode.getCode(),
                    action
            );
        }
    }

    private void ensureCurrentStatus(Invoice invoice, InvoiceStatusCode expectedCode, String action) {
        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        if (currentCode != expectedCode) {
            throw InvoiceStatusTransitionException.forAction(
                    invoice.getInvoiceId(),
                    currentCode.getCode(),
                    action
            );
        }
    }

    private void ensureRequiredFields(Invoice invoice, String action) {
        InvoiceStatusCode currentCode = getCurrentStatusCode(invoice);
        List<String> missingFields = new ArrayList<>();
        if (invoice.getSupplier() == null) {
            missingFields.add("supplierName");
        }
        if (isBlank(invoice.getInvoiceNumber())) {
            missingFields.add("invoiceNumber");
        }
        if (invoice.getInvoiceDate() == null) {
            missingFields.add("invoiceDate");
        }
        if (invoice.getTotalHt() == null) {
            missingFields.add("totalHt");
        }
        if (invoice.getTotalTva() == null) {
            missingFields.add("totalTva");
        }
        if (invoice.getTotalTtc() == null) {
            missingFields.add("totalTtc");
        }

        if (!missingFields.isEmpty()) {
            throw new InvoiceMissingRequiredFieldsException(
                    invoice.getInvoiceId(),
                    currentCode.getCode(),
                    missingFields,
                    action
            );
        }
    }

    private void updateStatus(Invoice invoice, InvoiceStatus status, User user, String comment) {
        invoice.setInvoiceStatus(status);
        invoice.setUpdatedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);
        saveStatusHistory(invoice, status, user, comment);
    }

    private void saveStatusHistory(Invoice invoice, InvoiceStatus status, User user, String comment) {
        InvoiceStatusHistory history = new InvoiceStatusHistory();
        history.setInvoice(invoice);
        history.setInvoiceStatus(status);
        history.setChangedByUser(user);
        history.setChangedAt(LocalDateTime.now());
        history.setComment(comment);
        invoiceStatusHistoryRepository.save(history);
    }

    private InvoiceStatusCode getCurrentStatusCode(Invoice invoice) {
        Long statusId = invoice.getInvoiceStatus().getInvoiceStatusId();
        String code = invoiceStatusRepository.findById(statusId)
                .map(InvoiceStatus::getCode)
                .orElseThrow(() -> new IllegalStateException("Invoice status " + statusId + " not found"));
        return InvoiceStatusCode.fromCode(code);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String requireReason(String reason, String missingReasonMessage) {
        if (isBlank(reason)) {
            throw new IllegalArgumentException(missingReasonMessage);
        }
        return reason.trim();
    }

    private static Map<InvoiceStatusCode, Set<InvoiceStatusCode>> buildAllowedPreviousStatuses() {
        Map<InvoiceStatusCode, Set<InvoiceStatusCode>> allowedPreviousStatuses =
                new EnumMap<>(InvoiceStatusCode.class);
        allowedPreviousStatuses.put(InvoiceStatusCode.OCR_EN_COURS, EnumSet.of(InvoiceStatusCode.DEPOSEE));
        allowedPreviousStatuses.put(InvoiceStatusCode.ERREUR_OCR, EnumSet.of(InvoiceStatusCode.OCR_EN_COURS));
        allowedPreviousStatuses.put(
                InvoiceStatusCode.EXTRAITE,
                EnumSet.of(InvoiceStatusCode.OCR_EN_COURS, InvoiceStatusCode.A_VERIFIER, InvoiceStatusCode.REJETEE)
        );

        allowedPreviousStatuses.put(
                InvoiceStatusCode.A_VERIFIER,
                EnumSet.of(InvoiceStatusCode.EXTRAITE, InvoiceStatusCode.ERREUR_OCR)
        );
        allowedPreviousStatuses.put(
                InvoiceStatusCode.VALIDEE,
                EnumSet.of(InvoiceStatusCode.A_VERIFIER, InvoiceStatusCode.EXPORTABLE)
        );
        allowedPreviousStatuses.put(
                InvoiceStatusCode.REJETEE,
                EnumSet.of(InvoiceStatusCode.EXTRAITE, InvoiceStatusCode.A_VERIFIER)
        );
        allowedPreviousStatuses.put(
                InvoiceStatusCode.EXPORTABLE,
                EnumSet.of(InvoiceStatusCode.VALIDEE, InvoiceStatusCode.COMPTABILISEE)
        );
        allowedPreviousStatuses.put(InvoiceStatusCode.EXPORTEE, EnumSet.of(InvoiceStatusCode.EXPORTABLE));
        allowedPreviousStatuses.put(InvoiceStatusCode.ARCHIVEE, EnumSet.of(InvoiceStatusCode.EXPORTEE));
        return allowedPreviousStatuses;
    }
}
