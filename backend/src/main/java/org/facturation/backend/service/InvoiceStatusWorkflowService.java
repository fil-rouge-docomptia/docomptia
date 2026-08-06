package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;

public interface InvoiceStatusWorkflowService {

    InvoiceStatus findByCode(InvoiceStatusCode code);

    InvoiceStatus findByCode(String code);

    void recordUpload(Invoice invoice, User user);

    void startOcrAnalysis(Invoice invoice, User user);

    void ensureCanRetryOcr(Invoice invoice);

    void restartOcrAnalysis(Invoice invoice, User user);

    void markOcrFailure(Invoice invoice, User user);

    void completeOcrAnalysis(Invoice invoice, User user);

    void ensureCanCorrect(Invoice invoice, boolean hasCorrections);

    void moveToReviewAfterCorrectionIfNeeded(Invoice invoice, User user, boolean hasCorrections);

    void validateInvoice(Invoice invoice, User user);

    void rejectInvoice(Invoice invoice, User user);

    void markExportable(Invoice invoice, User user);

    void ensureCanTransition(Invoice invoice, InvoiceStatusCode targetCode);

    void transitionTo(Invoice invoice, InvoiceStatusCode targetCode, User user, String comment);
}
