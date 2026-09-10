package org.facturation.backend.exception;

import org.facturation.backend.model.OcrError;

public class InvoicePostOcrFailureException extends IllegalStateException {

    private final Long invoiceId;
    private final OcrError ocrError;

    public InvoicePostOcrFailureException(Long invoiceId, OcrError ocrError, RuntimeException cause) {
        super("Invoice processing failed after OCR analysis", cause);
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
