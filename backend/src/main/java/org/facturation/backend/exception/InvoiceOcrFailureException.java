package org.facturation.backend.exception;

import org.facturation.backend.model.OcrError;

public class InvoiceOcrFailureException extends IllegalStateException {

    private final Long invoiceId;
    private final OcrError ocrError;

    public InvoiceOcrFailureException(Long invoiceId, OcrError ocrError, RuntimeException cause) {
        super("Invoice OCR analysis failed", cause);
        this.invoiceId = invoiceId;
        this.ocrError = ocrError;
    }

    public Long getInvoiceId() {
        return invoiceId;
    }

    public OcrError getOcrError() {
        return ocrError;
    }
}
