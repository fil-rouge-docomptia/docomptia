package org.facturation.backend.dto.request;

public class InvoiceCorrectionRequest {

    private String invoiceNumber;
    private String commandReference;
    private String invoiceDate;
    private String dueDate;
    private String totalHt;
    private String totalTva;
    private String totalTtc;
    private String supplierName;

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

    public String getSupplierName() {
        return supplierName;
    }

    public void setSupplierName(String supplierName) {
        this.supplierName = supplierName;
    }
}
