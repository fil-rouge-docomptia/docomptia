package org.facturation.backend.service;

import org.facturation.backend.model.OcrError;
import org.facturation.backend.model.OcrErrorStep;
import org.facturation.backend.model.User;

public interface InvoicePostOcrFailureService {

    OcrError recordFailure(Long invoiceId, User user, RuntimeException exception, OcrErrorStep step);
}
