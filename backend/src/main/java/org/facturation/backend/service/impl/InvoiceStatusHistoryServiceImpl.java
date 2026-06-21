package org.facturation.backend.service.impl;

import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.service.InvoiceStatusHistoryService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class InvoiceStatusHistoryServiceImpl implements InvoiceStatusHistoryService {

    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    public InvoiceStatusHistoryServiceImpl(InvoiceStatusHistoryRepository invoiceStatusHistoryRepository) {
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
    }

    @Override
    public List<InvoiceStatusHistory> findAll() {
        return invoiceStatusHistoryRepository.findAll();
    }

    @Override
    public Optional<InvoiceStatusHistory> findById(Long id) {
        return invoiceStatusHistoryRepository.findById(id);
    }

    @Override
    public InvoiceStatusHistory save(InvoiceStatusHistory invoiceStatusHistory) {
        return invoiceStatusHistoryRepository.save(invoiceStatusHistory);
    }
}
