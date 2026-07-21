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

import java.time.LocalDateTime;

@Entity
@Table(name = "accounting_rules")
public class AccountingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long accountingRuleId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(nullable = false)
    private String ruleName;

    private String keyword;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "expense_account_id", nullable = false)
    private ChartOfAccount expenseAccount;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vat_account_id", nullable = false)
    private ChartOfAccount vatAccount;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_account_id", nullable = false)
    private ChartOfAccount supplierAccount;

    @Column(nullable = false)
    private Integer priority;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public Long getAccountingRuleId() {
        return accountingRuleId;
    }

    public void setAccountingRuleId(Long accountingRuleId) {
        this.accountingRuleId = accountingRuleId;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public String getRuleName() {
        return ruleName;
    }

    public void setRuleName(String ruleName) {
        this.ruleName = ruleName;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public ChartOfAccount getExpenseAccount() {
        return expenseAccount;
    }

    public void setExpenseAccount(ChartOfAccount expenseAccount) {
        this.expenseAccount = expenseAccount;
    }

    public ChartOfAccount getVatAccount() {
        return vatAccount;
    }

    public void setVatAccount(ChartOfAccount vatAccount) {
        this.vatAccount = vatAccount;
    }

    public ChartOfAccount getSupplierAccount() {
        return supplierAccount;
    }

    public void setSupplierAccount(ChartOfAccount supplierAccount) {
        this.supplierAccount = supplierAccount;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
