package org.facturation.backend.service.impl;

import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.service.InvoiceStatusService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class InvoiceStatusServiceImpl implements InvoiceStatusService {

    private final InvoiceStatusRepository invoiceStatusRepository;

    public InvoiceStatusServiceImpl(InvoiceStatusRepository invoiceStatusRepository) {
        this.invoiceStatusRepository = invoiceStatusRepository;
    }

    @Override
    public List<InvoiceStatus> findAll() {
        return invoiceStatusRepository.findAll();
    }

    @Override
    public Optional<InvoiceStatus> findById(Long id) {
        return invoiceStatusRepository.findById(id);
    }

    @Override
    public InvoiceStatus save(InvoiceStatus invoiceStatus) {
        return invoiceStatusRepository.save(invoiceStatus);
    }
}
