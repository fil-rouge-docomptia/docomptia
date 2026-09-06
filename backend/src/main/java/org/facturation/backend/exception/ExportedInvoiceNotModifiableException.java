package org.facturation.backend.exception;

public class ExportedInvoiceNotModifiableException extends RuntimeException {

    public ExportedInvoiceNotModifiableException(Long invoiceId) {
        super("Exported invoice " + invoiceId + " cannot be modified directly; create a reversal instead");
    }
}
