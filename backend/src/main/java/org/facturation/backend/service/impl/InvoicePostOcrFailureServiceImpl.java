package org.facturation.backend.service.impl;

import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.InvoicePostOcrFailureService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.OcrErrorService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoicePostOcrFailureServiceImpl implements InvoicePostOcrFailureService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final OcrErrorService ocrErrorService;

    public InvoicePostOcrFailureServiceImpl(
            InvoiceRepository invoiceRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            OcrErrorService ocrErrorService
    ) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.ocrErrorService = ocrErrorService;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OcrError recordFailure(Long invoiceId, User user, RuntimeException exception, OcrErrorStep step) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new InvoiceNotFoundException(invoiceId));
        invoiceStatusWorkflowService.markProcessingFailure(invoice, user);
        return ocrErrorService.recordFailure(invoice, exception, step);
    }
}
