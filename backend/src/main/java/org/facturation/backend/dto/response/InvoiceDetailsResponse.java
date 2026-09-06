package org.facturation.backend.dto.response;

import java.util.List;

public class InvoiceDetailsResponse {

    private Long invoiceId;
    private String invoiceNumber;
    private String commandReference;
    private String invoiceDate;
    private String dueDate;
    private String paymentDate;
    private String paymentReference;
    private Long paidByUserId;
    private String archivedAt;
    private String status;
    private String supplierName;
    private InvoiceSupplierResponse supplier;
    private ClassificationResponse classification;
    private InvoiceAssigneeResponse assignee;
    private String currencyCode;
    private String totalHt;
    private String totalTva;
    private String totalTtc;
    private String filePath;
    private OcrAnalysisResponse ocrAnalysis;
    private OcrErrorResponse ocrError;
    private AccountingEntryResponse accountingEntry;
    private List<InvoiceDuplicateAlertResponse> duplicateAlerts;
    private List<InvoiceHistoryItemResponse> history;

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

    public String getCommandReference() {
        return commandReference;
    }

    public void setCommandReference(String commandReference) {
        this.commandReference = commandReference;
    }

    public String getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(String invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public String getDueDate() {
        return dueDate;
    }

    public void setDueDate(String dueDate) {
        this.dueDate = dueDate;
    }

    public String getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(String paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public Long getPaidByUserId() {
        return paidByUserId;
    }

    public void setPaidByUserId(Long paidByUserId) {
        this.paidByUserId = paidByUserId;
    }

    public String getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(String archivedAt) {
        this.archivedAt = archivedAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSupplierName() {
        return supplierName;
    }

    public void setSupplierName(String supplierName) {
        this.supplierName = supplierName;
    }

    public InvoiceSupplierResponse getSupplier() { return supplier; }
    public void setSupplier(InvoiceSupplierResponse supplier) { this.supplier = supplier; }

    public ClassificationResponse getClassification() { return classification; }

    public void setClassification(ClassificationResponse classification) { this.classification = classification; }

    public InvoiceAssigneeResponse getAssignee() {
        return assignee;
    }

    public void setAssignee(InvoiceAssigneeResponse assignee) {
        this.assignee = assignee;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public void setCurrencyCode(String currencyCode) {
        this.currencyCode = currencyCode;
    }

    public String getTotalHt() {
        return totalHt;
    }

    public void setTotalHt(String totalHt) {
        this.totalHt = totalHt;
    }

    public String getTotalTva() {
        return totalTva;
    }

    public void setTotalTva(String totalTva) {
        this.totalTva = totalTva;
    }

    public String getTotalTtc() {
        return totalTtc;
    }

    public void setTotalTtc(String totalTtc) {
        this.totalTtc = totalTtc;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public OcrAnalysisResponse getOcrAnalysis() {
        return ocrAnalysis;
    }

    public void setOcrAnalysis(OcrAnalysisResponse ocrAnalysis) {
        this.ocrAnalysis = ocrAnalysis;
    }

    public OcrErrorResponse getOcrError() {
        return ocrError;
    }

    public void setOcrError(OcrErrorResponse ocrError) {
        this.ocrError = ocrError;
    }

    public AccountingEntryResponse getAccountingEntry() {
        return accountingEntry;
    }

    public void setAccountingEntry(AccountingEntryResponse accountingEntry) {
        this.accountingEntry = accountingEntry;
    }

    public List<InvoiceDuplicateAlertResponse> getDuplicateAlerts() {
        return duplicateAlerts;
    }

    public void setDuplicateAlerts(List<InvoiceDuplicateAlertResponse> duplicateAlerts) {
        this.duplicateAlerts = duplicateAlerts;
    }

    public List<InvoiceHistoryItemResponse> getHistory() {
        return history;
    }

    public void setHistory(List<InvoiceHistoryItemResponse> history) {
        this.history = history;
    }
}
