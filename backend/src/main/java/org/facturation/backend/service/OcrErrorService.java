package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorStep;

import java.util.Optional;

public interface OcrErrorService {

    OcrError recordFailure(Invoice invoice, RuntimeException exception);

    OcrError recordFailure(Invoice invoice, RuntimeException exception, OcrErrorStep step);

    Optional<OcrError> findLatestByInvoiceId(Long invoiceId);
}
