package org.facturation.backend.service.impl;

import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.service.InvoiceFileService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class InvoiceFileServiceImpl implements InvoiceFileService {

    private final InvoiceFileRepository invoiceFileRepository;

    public InvoiceFileServiceImpl(InvoiceFileRepository invoiceFileRepository) {
        this.invoiceFileRepository = invoiceFileRepository;
    }

    @Override
    public List<InvoiceFile> findAll() {
        return invoiceFileRepository.findAll();
    }

    @Override
    public Optional<InvoiceFile> findById(Long id) {
        return invoiceFileRepository.findById(id);
    }

    @Override
    public InvoiceFile save(InvoiceFile invoiceFile) {
        return invoiceFileRepository.save(invoiceFile);
    }
}
