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

    void ensureModifiable(Invoice invoice);

    void reintegrateAfterCorrectionIfNeeded(Invoice invoice, User user, boolean hasCorrections);

    void submitForValidation(Invoice invoice, User user);

    void validateInvoice(Invoice invoice, User user);

    void requestInvoiceCorrection(Invoice invoice, User user, String reason);

    void rejectInvoice(Invoice invoice, User user, String reason);

    void rejectInvoiceAsDuplicate(Invoice invoice, User user, String reason);

    void ensureCanGenerateAccountingEntry(Invoice invoice);

    void markExportable(Invoice invoice, User user);

    void markAccountingEntryToCorrect(Invoice invoice, User user);

    void markPaid(Invoice invoice, User user);

    void markArchived(Invoice invoice, User user);

    void ensureCanTransition(Invoice invoice, InvoiceStatusCode targetCode);

    void transitionTo(Invoice invoice, InvoiceStatusCode targetCode, User user, String comment);
}
