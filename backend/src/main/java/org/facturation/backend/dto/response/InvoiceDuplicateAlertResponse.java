package org.facturation.backend.dto.response;

public class InvoiceDuplicateAlertResponse {

    private Long existingInvoiceId;

    public Long getExistingInvoiceId() {
        return existingInvoiceId;
    }

    public void setExistingInvoiceId(Long existingInvoiceId) {
        this.existingInvoiceId = existingInvoiceId;
    }
}
