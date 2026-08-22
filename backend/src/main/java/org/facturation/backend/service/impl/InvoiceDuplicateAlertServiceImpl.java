package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceDuplicateAlertResponse;
import org.facturation.backend.model.DuplicateAlertType;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class InvoiceDuplicateAlertServiceImpl implements InvoiceDuplicateAlertService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceDuplicateAlertRepository duplicateAlertRepository;

    public InvoiceDuplicateAlertServiceImpl(
            InvoiceRepository invoiceRepository,
            InvoiceDuplicateAlertRepository duplicateAlertRepository
    ) {
        this.invoiceRepository = invoiceRepository;
        this.duplicateAlertRepository = duplicateAlertRepository;
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
        response.setType(alert.getAlertType().name());
        response.setMatchingInvoiceId(alert.getMatchingInvoice().getInvoiceId());
        response.setMatchingInvoiceNumber(alert.getMatchingInvoice().getInvoiceNumber());
        response.setSupplierId(alert.getSupplier().getSupplierId());
        response.setInvoiceDate(alert.getInvoiceDate() == null ? null : alert.getInvoiceDate().toString());
        response.setTotalTtc(alert.getTotalTtc() == null ? null : alert.getTotalTtc().toString());
        response.setConfidenceLevel(alert.getAlertType().name());
        response.setCreatedAt(alert.getCreatedAt().toString());
        return response;
    }
}
