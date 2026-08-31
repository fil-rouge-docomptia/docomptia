package org.facturation.backend.exception;

public class InvoiceFileNotPreviewableException extends RuntimeException {

    public InvoiceFileNotPreviewableException(String mimeType) {
        super("Invoice file cannot be previewed with MIME type: " + mimeType);
    }
}
