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
    public void detectProbableDuplicates(Invoice invoice) {
        if (invoice.getSupplier() == null || invoice.getInvoiceDate() == null || invoice.getTotalTtc() == null) {
            return;
        }

        invoiceRepository.findProbableDuplicates(
                invoice.getOrganization().getOrganizationId(),
                invoice.getSupplier().getSupplierId(),
                invoice.getInvoiceDate(),
                invoice.getTotalTtc(),
                invoice.getInvoiceId()
        ).stream()
                .filter(match -> !duplicateAlertRepository.existsByInvoiceInvoiceIdAndMatchingInvoiceInvoiceId(
                        invoice.getInvoiceId(), match.getInvoiceId()
                ))
                .map(match -> createAlert(invoice, match))
                .forEach(duplicateAlertRepository::save);
    }

    @Override
    public List<InvoiceDuplicateAlertResponse> findByInvoiceId(Long invoiceId) {
        return duplicateAlertRepository.findByInvoiceInvoiceIdOrderByCreatedAtAsc(invoiceId).stream()
                .map(this::toResponse)
                .toList();
    }

    private InvoiceDuplicateAlert createAlert(Invoice invoice, Invoice matchingInvoice) {
        InvoiceDuplicateAlert alert = new InvoiceDuplicateAlert();
        alert.setInvoice(invoice);
        alert.setMatchingInvoice(matchingInvoice);
        alert.setSupplier(invoice.getSupplier());
        alert.setAlertType(DuplicateAlertType.PROBABLE);
        alert.setInvoiceDate(invoice.getInvoiceDate());
        alert.setTotalTtc(invoice.getTotalTtc());
        alert.setCreatedAt(LocalDateTime.now());
        return alert;
    }

    private InvoiceDuplicateAlertResponse toResponse(InvoiceDuplicateAlert alert) {
        InvoiceDuplicateAlertResponse response = new InvoiceDuplicateAlertResponse();
        response.setType(alert.getAlertType().name());
        response.setMatchingInvoiceId(alert.getMatchingInvoice().getInvoiceId());
        response.setSupplierId(alert.getSupplier().getSupplierId());
        response.setInvoiceDate(alert.getInvoiceDate().toString());
        response.setTotalTtc(alert.getTotalTtc().toString());
        return response;
    }
}
