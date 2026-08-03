package org.facturation.backend.dto.response;

public class InvoiceOcrFailureResponse {

    private Long invoiceId;
    private String status;
    private OcrErrorResponse ocrError;

    public Long getInvoiceId() {
        return invoiceId;
    }

    public void setInvoiceId(Long invoiceId) {
        this.invoiceId = invoiceId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OcrErrorResponse getOcrError() {
        return ocrError;
    }

    public void setOcrError(OcrErrorResponse ocrError) {
        this.ocrError = ocrError;
    }
}
