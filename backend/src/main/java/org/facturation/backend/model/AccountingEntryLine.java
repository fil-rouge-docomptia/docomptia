package org.facturation.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "accounting_entry_lines")
public class AccountingEntryLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long accountingEntryLineId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "accounting_entry_id", nullable = false)
    private AccountingEntry accountingEntry;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private ChartOfAccount account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_account_id")
    private SupplierAccount supplierAccount;

    @Column(nullable = false)
    private Integer lineNumber;

    private String lineLabel;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal debitAmount;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal creditAmount;

    private LocalDateTime createdAt;

    public Long getAccountingEntryLineId() {
        return accountingEntryLineId;
    }

    public void setAccountingEntryLineId(Long accountingEntryLineId) {
        this.accountingEntryLineId = accountingEntryLineId;
    }

    public AccountingEntry getAccountingEntry() {
        return accountingEntry;
    }

    public void setAccountingEntry(AccountingEntry accountingEntry) {
        this.accountingEntry = accountingEntry;
    }

    public ChartOfAccount getAccount() {
        return account;
    }

    public void setAccount(ChartOfAccount account) {
        this.account = account;
    }

    public SupplierAccount getSupplierAccount() {
        return supplierAccount;
    }

    public void setSupplierAccount(SupplierAccount supplierAccount) {
        this.supplierAccount = supplierAccount;
    }

    public Integer getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(Integer lineNumber) {
        this.lineNumber = lineNumber;
    }

    public String getLineLabel() {
        return lineLabel;
    }

    public void setLineLabel(String lineLabel) {
        this.lineLabel = lineLabel;
    }

    public BigDecimal getDebitAmount() {
        return debitAmount;
    }

    public void setDebitAmount(BigDecimal debitAmount) {
        this.debitAmount = debitAmount;
    }

    public BigDecimal getCreditAmount() {
        return creditAmount;
    }

    public void setCreditAmount(BigDecimal creditAmount) {
        this.creditAmount = creditAmount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
