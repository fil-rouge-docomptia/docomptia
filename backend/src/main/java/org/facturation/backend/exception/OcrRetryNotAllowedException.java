package org.facturation.backend.exception;

public class OcrRetryNotAllowedException extends IllegalStateException {

    public OcrRetryNotAllowedException(Long invoiceId) {
        super("Invoice " + invoiceId + " is not in OCR error status");
    }
}
