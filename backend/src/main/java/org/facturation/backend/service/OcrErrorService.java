package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrError;

import java.util.Optional;

public interface OcrErrorService {

    OcrError recordFailure(Invoice invoice, RuntimeException exception);

    Optional<OcrError> findLatestByInvoiceId(Long invoiceId);
}
