package org.facturation.backend.service.impl;

import org.facturation.backend.exception.InvoiceStatusTransitionException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Service
public class InvoiceStatusWorkflowServiceImpl implements InvoiceStatusWorkflowService {

    private static final Map<InvoiceStatusCode, Set<InvoiceStatusCode>> ALLOWED_PREVIOUS_STATUSES =
            buildAllowedPreviousStatuses();

    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    public InvoiceStatusWorkflowServiceImpl(
            InvoiceRepository invoiceRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository
    ) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
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

    @Override
    public void recordStatus(Invoice invoice, InvoiceStatus status, User user, String comment) {
        saveStatusHistory(invoice, status, user, comment);
    }

    @Override
    public void updateStatus(Invoice invoice, InvoiceStatus status, User user, String comment) {
        invoice.setInvoiceStatus(status);
        invoice.setUpdatedAt(LocalDateTime.now());
        invoiceRepository.save(invoice);
        saveStatusHistory(invoice, status, user, comment);
    }

    @Override
    public void updateStatusIfChanged(Invoice invoice, InvoiceStatus status, User user, String comment) {
        if (getCurrentStatusCode(invoice).getCode().equals(status.getCode())) {
            return;
        }
        updateStatus(invoice, status, user, comment);
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

    private static Map<InvoiceStatusCode, Set<InvoiceStatusCode>> buildAllowedPreviousStatuses() {
        Map<InvoiceStatusCode, Set<InvoiceStatusCode>> allowedPreviousStatuses =
                new EnumMap<>(InvoiceStatusCode.class);
        allowedPreviousStatuses.put(InvoiceStatusCode.OCR_EN_COURS, EnumSet.of(InvoiceStatusCode.DEPOSEE));
        allowedPreviousStatuses.put(InvoiceStatusCode.ERREUR_OCR, EnumSet.of(InvoiceStatusCode.OCR_EN_COURS));
        allowedPreviousStatuses.put(InvoiceStatusCode.EXTRAITE, EnumSet.of(InvoiceStatusCode.OCR_EN_COURS));
        allowedPreviousStatuses.put(
                InvoiceStatusCode.A_VERIFIER,
                EnumSet.of(InvoiceStatusCode.ERREUR_OCR, InvoiceStatusCode.REJETEE)
        );
        allowedPreviousStatuses.put(
                InvoiceStatusCode.VALIDEE,
                EnumSet.of(InvoiceStatusCode.EXTRAITE, InvoiceStatusCode.A_VERIFIER)
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
