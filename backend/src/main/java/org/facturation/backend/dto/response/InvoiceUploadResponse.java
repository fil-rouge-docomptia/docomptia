package org.facturation.backend.dto.response;

public class InvoiceUploadResponse {

    private Long invoiceId;
    private String invoiceNumber;
    private String status;
    private OcrAnalysisResponse ocrAnalysis;

    public Long getInvoiceId() {
        return invoiceId;
    }

    public void setInvoiceId(Long invoiceId) {
        this.invoiceId = invoiceId;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OcrAnalysisResponse getOcrAnalysis() {
        return ocrAnalysis;
    }

    public void setOcrAnalysis(OcrAnalysisResponse ocrAnalysis) {
        this.ocrAnalysis = ocrAnalysis;
    }
}
