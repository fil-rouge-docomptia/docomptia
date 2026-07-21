package org.facturation.backend.dto.response;

public class InvoiceAccountingEntryResponse {

    private Long invoiceId;
    private String status;
    private AccountingEntryResponse accountingEntry;

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

    public AccountingEntryResponse getAccountingEntry() {
        return accountingEntry;
    }

    public void setAccountingEntry(AccountingEntryResponse accountingEntry) {
        this.accountingEntry = accountingEntry;
    }
}
