package org.facturation.backend.dto.response;

public class InvoiceDuplicateAlertResponse {

    private String type;
    private Long matchingInvoiceId;
    private String matchingInvoiceNumber;
    private Long supplierId;
    private String invoiceDate;
    private String totalTtc;
    private String confidenceLevel;
    private String createdAt;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getMatchingInvoiceId() {
        return matchingInvoiceId;
    }

    public void setMatchingInvoiceId(Long matchingInvoiceId) {
        this.matchingInvoiceId = matchingInvoiceId;
    }

    public String getMatchingInvoiceNumber() {
        return matchingInvoiceNumber;
    }

    public void setMatchingInvoiceNumber(String matchingInvoiceNumber) {
        this.matchingInvoiceNumber = matchingInvoiceNumber;
    }

    public Long getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(Long supplierId) {
        this.supplierId = supplierId;
    }

    public String getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(String invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public String getTotalTtc() {
        return totalTtc;
    }

    public void setTotalTtc(String totalTtc) {
        this.totalTtc = totalTtc;
    }

    public String getConfidenceLevel() {
        return confidenceLevel;
    }

    public void setConfidenceLevel(String confidenceLevel) {
        this.confidenceLevel = confidenceLevel;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
