package org.facturation.backend.service.impl;

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

@Service
public class InvoiceStatusWorkflowServiceImpl implements InvoiceStatusWorkflowService {

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
        if (invoice.getInvoiceStatus().getCode().equals(status.getCode())) {
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
}
