package org.facturation.backend.service;

import org.facturation.backend.exception.InvoiceFileNotFoundException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceFileIntegrityStatus;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.service.storage.InvoiceFileStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class LegalRetentionService {

    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceFileStorageService invoiceFileStorageService;
    private final InvoiceFileIntegrityService invoiceFileIntegrityService;
    private final int retentionDurationYears;

    public LegalRetentionService(
            InvoiceFileRepository invoiceFileRepository,
            InvoiceFileStorageService invoiceFileStorageService,
            InvoiceFileIntegrityService invoiceFileIntegrityService,
            @Value("${app.legal-retention.duration-years:10}") int retentionDurationYears
    ) {
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceFileStorageService = invoiceFileStorageService;
        this.invoiceFileIntegrityService = invoiceFileIntegrityService;
        this.retentionDurationYears = retentionDurationYears;
    }

    public void record(Invoice invoice, LocalDateTime archivedAt) {
        invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId()).ifPresent(invoiceFile -> {
            invoiceFile.setArchivedAt(archivedAt);
            invoiceFile.setRetentionDurationYears(retentionDurationYears);
            invoiceFile.setIntegrityStatus(verifyIntegrity(invoiceFile));
            invoiceFileRepository.save(invoiceFile);
        });
    }

    private InvoiceFileIntegrityStatus verifyIntegrity(InvoiceFile invoiceFile) {
        if (invoiceFile.getSha256Checksum() == null) {
            return InvoiceFileIntegrityStatus.NOT_VERIFIED;
        }
        try {
            String storedFileChecksum = invoiceFileIntegrityService.calculateSha256(
                    invoiceFileStorageService.load(invoiceFile)
            );
            return invoiceFile.getSha256Checksum().equals(storedFileChecksum)
                    ? InvoiceFileIntegrityStatus.VERIFIED
                    : InvoiceFileIntegrityStatus.ANOMALY_DETECTED;
        } catch (InvoiceFileNotFoundException exception) {
            return InvoiceFileIntegrityStatus.ANOMALY_DETECTED;
        }
    }
}
