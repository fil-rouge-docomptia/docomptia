package org.facturation.backend.dto.response;

public class AccountingEntryLineResponse {

    private Long accountId;
    private String vatRate;
    private Long classificationId;
    private String classificationName;
    private String classificationType;

    public Long getAccountId() { return accountId; }
    public void setAccountId(Long accountId) { this.accountId = accountId; }
    public String getVatRate() { return vatRate; }
    public void setVatRate(String vatRate) { this.vatRate = vatRate; }
    public Long getClassificationId() { return classificationId; }
    public void setClassificationId(Long classificationId) { this.classificationId = classificationId; }
    public String getClassificationName() { return classificationName; }
    public void setClassificationName(String classificationName) { this.classificationName = classificationName; }
    public String getClassificationType() { return classificationType; }
    public void setClassificationType(String classificationType) { this.classificationType = classificationType; }

    private Long accountingEntryLineId;
    private Integer lineNumber;
    private String accountNumber;
    private String accountLabel;
    private String supplierAccountCode;
    private String supplierAccountLabel;
    private String lineLabel;
    private String debitAmount;
    private String creditAmount;

    public Long getAccountingEntryLineId() {
        return accountingEntryLineId;
    }

    public void setAccountingEntryLineId(Long accountingEntryLineId) {
        this.accountingEntryLineId = accountingEntryLineId;
    }

    public Integer getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(Integer lineNumber) {
        this.lineNumber = lineNumber;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getAccountLabel() {
        return accountLabel;
    }

    public void setAccountLabel(String accountLabel) {
        this.accountLabel = accountLabel;
    }

    public String getSupplierAccountCode() {
        return supplierAccountCode;
    }

    public void setSupplierAccountCode(String supplierAccountCode) {
        this.supplierAccountCode = supplierAccountCode;
    }

    public String getSupplierAccountLabel() {
        return supplierAccountLabel;
    }

    public void setSupplierAccountLabel(String supplierAccountLabel) {
        this.supplierAccountLabel = supplierAccountLabel;
    }

    public String getLineLabel() {
        return lineLabel;
    }

    public void setLineLabel(String lineLabel) {
        this.lineLabel = lineLabel;
    }

    public String getDebitAmount() {
        return debitAmount;
    }

    public void setDebitAmount(String debitAmount) {
        this.debitAmount = debitAmount;
    }

    public String getCreditAmount() {
        return creditAmount;
    }

    public void setCreditAmount(String creditAmount) {
        this.creditAmount = creditAmount;
    }
}
