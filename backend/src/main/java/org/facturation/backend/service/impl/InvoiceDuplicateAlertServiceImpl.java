package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceDuplicateAlertResponse;
import org.facturation.backend.exception.DuplicateAlertDecisionException;
import org.facturation.backend.exception.DuplicateAlertNotFoundException;
import org.facturation.backend.exception.PendingDuplicateAlertException;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.DuplicateAlertType;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class InvoiceDuplicateAlertServiceImpl implements InvoiceDuplicateAlertService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceDuplicateAlertRepository duplicateAlertRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;

    public InvoiceDuplicateAlertServiceImpl(
            InvoiceRepository invoiceRepository,
            InvoiceDuplicateAlertRepository duplicateAlertRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.duplicateAlertRepository = duplicateAlertRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
    }

    @Override
    public void detectDuplicates(Invoice invoice) {
        if (invoice.getSupplier() == null) {
            return;
        }

        detectCertainDuplicates(invoice);
        detectProbableDuplicates(invoice);
    }

    private void detectCertainDuplicates(Invoice invoice) {
        if (invoice.getInvoiceNumber() == null) {
            return;
        }

        invoiceRepository.findCertainDuplicates(
                invoice.getOrganization().getOrganizationId(),
                invoice.getSupplier().getSupplierId(),
                invoice.getInvoiceNumber(),
                invoice.getInvoiceId()
        ).stream()
                .filter(match -> !alertExists(invoice, match))
                .map(match -> createAlert(invoice, match, DuplicateAlertType.CERTAIN))
                .forEach(duplicateAlertRepository::save);
    }

    private void detectProbableDuplicates(Invoice invoice) {
        if (invoice.getInvoiceDate() == null || invoice.getTotalTtc() == null) {
            return;
        }

        invoiceRepository.findProbableDuplicates(
                invoice.getOrganization().getOrganizationId(),
                invoice.getSupplier().getSupplierId(),
                invoice.getInvoiceDate(),
                invoice.getTotalTtc(),
                invoice.getInvoiceId()
        ).stream()
                .filter(match -> !alertExists(invoice, match))
                .map(match -> createAlert(invoice, match, DuplicateAlertType.PROBABLE))
                .forEach(duplicateAlertRepository::save);
    }

    @Override
    public List<InvoiceDuplicateAlertResponse> findByInvoiceId(Long invoiceId) {
        return duplicateAlertRepository.findByInvoiceInvoiceIdOrderByCreatedAtAsc(invoiceId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public void ensureNoPendingAlerts(Long invoiceId, String action) {
        if (duplicateAlertRepository.existsByInvoiceInvoiceIdAndDecision(
                invoiceId,
                DuplicateAlertDecision.PENDING
        )) {
            throw new PendingDuplicateAlertException(invoiceId, action);
        }
    }

    @Override
    public Invoice decide(
            Long invoiceId,
            Long alertId,
            DuplicateAlertDecision decision,
            String reason,
            User user
    ) {
        if (decision == null || decision == DuplicateAlertDecision.PENDING) {
            throw new IllegalArgumentException("Decision must be IGNORE, CONFIRM or REJECT");
        }

        InvoiceDuplicateAlert alert = duplicateAlertRepository
                .findByDuplicateAlertIdAndInvoiceInvoiceIdAndInvoiceOrganizationOrganizationId(
                        alertId,
                        invoiceId,
                        user.getOrganization().getOrganizationId()
                )
                .orElseThrow(() -> new DuplicateAlertNotFoundException(alertId, invoiceId));
        if (alert.getDecision() != DuplicateAlertDecision.PENDING) {
            throw new DuplicateAlertDecisionException(alertId, alert.getDecision().name());
        }

        String decisionReason = normalizeReason(reason);
        if (decision == DuplicateAlertDecision.REJECT && decisionReason == null) {
            throw new IllegalArgumentException("Rejection reason is required");
        }

        alert.setDecision(decision);
        alert.setDecisionReason(decisionReason);
        alert.setDecidedByUser(user);
        alert.setDecidedAt(LocalDateTime.now());
        duplicateAlertRepository.save(alert);

        Invoice invoice = alert.getInvoice();
        applyWorkflowDecision(invoice, decision, decisionReason, user);
        return invoice;
    }

    private void applyWorkflowDecision(
            Invoice invoice,
            DuplicateAlertDecision decision,
            String reason,
            User user
    ) {
        switch (decision) {
            case IGNORE -> continueAfterLastPendingAlert(invoice, user);
            case CONFIRM -> invoiceStatusWorkflowService.rejectInvoiceAsDuplicate(
                    invoice,
                    user,
                    "Duplicate invoice confirmed"
            );
            case REJECT -> invoiceStatusWorkflowService.rejectInvoiceAsDuplicate(invoice, user, reason);
            case PENDING -> throw new IllegalArgumentException("A pending alert is not a decision");
        }
    }

    private void continueAfterLastPendingAlert(Invoice invoice, User user) {
        if (!duplicateAlertRepository.existsByInvoiceInvoiceIdAndDecision(
                invoice.getInvoiceId(),
                DuplicateAlertDecision.PENDING
        )) {
            invoiceStatusWorkflowService.transitionTo(
                    invoice,
                    InvoiceStatusCode.A_VERIFIER,
                    user,
                    "Duplicate alerts ignored; invoice ready for review"
            );
        }
    }

    private String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return null;
        }
        return reason.trim();
    }

    private boolean alertExists(Invoice invoice, Invoice matchingInvoice) {
        return duplicateAlertRepository.existsByInvoiceInvoiceIdAndMatchingInvoiceInvoiceId(
                invoice.getInvoiceId(), matchingInvoice.getInvoiceId()
        );
    }

    private InvoiceDuplicateAlert createAlert(
            Invoice invoice,
            Invoice matchingInvoice,
            DuplicateAlertType alertType
    ) {
        InvoiceDuplicateAlert alert = new InvoiceDuplicateAlert();
        alert.setInvoice(invoice);
        alert.setMatchingInvoice(matchingInvoice);
        alert.setSupplier(invoice.getSupplier());
        alert.setAlertType(alertType);
        alert.setInvoiceDate(invoice.getInvoiceDate());
        alert.setTotalTtc(invoice.getTotalTtc());
        alert.setCreatedAt(LocalDateTime.now());
        return alert;
    }

    private InvoiceDuplicateAlertResponse toResponse(InvoiceDuplicateAlert alert) {
        InvoiceDuplicateAlertResponse response = new InvoiceDuplicateAlertResponse();
        response.setAlertId(alert.getDuplicateAlertId());
        response.setType(alert.getAlertType().name());
        response.setMatchingInvoiceId(alert.getMatchingInvoice().getInvoiceId());
        response.setMatchingInvoiceNumber(alert.getMatchingInvoice().getInvoiceNumber());
        response.setSupplierId(alert.getSupplier().getSupplierId());
        response.setInvoiceDate(alert.getInvoiceDate() == null ? null : alert.getInvoiceDate().toString());
        response.setTotalTtc(alert.getTotalTtc() == null ? null : alert.getTotalTtc().toString());
        response.setConfidenceLevel(alert.getAlertType().name());
        response.setCreatedAt(alert.getCreatedAt().toString());
        response.setDecision(alert.getDecision().name());
        response.setDecidedByUserId(
                alert.getDecidedByUser() == null ? null : alert.getDecidedByUser().getUserId()
        );
        response.setDecidedAt(alert.getDecidedAt() == null ? null : alert.getDecidedAt().toString());
        response.setDecisionReason(alert.getDecisionReason());
        return response;
    }
}
