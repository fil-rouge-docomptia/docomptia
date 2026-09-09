package org.facturation.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "supplier_accounts",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_supplier_accounts_organization_code",
                columnNames = {"organization_id", "code"}
        )
)
public class SupplierAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long supplierAccountId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "collective_account_id", nullable = false)
    private ChartOfAccount collectiveAccount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String label;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void validateAssociations() {
        if (organization == null || collectiveAccount == null) {
            return;
        }

        ChartOfAccount account = collectiveAccount;
        if (!belongsToOrganization(account.getOrganization())) {
            throw new IllegalArgumentException("Collective account must belong to the supplier account organization");
        }
        if (!account.isActive()
                || account.getAccountNumber() == null
                || !account.getAccountNumber().startsWith("4")) {
            throw new IllegalArgumentException("Collective account must be an active class 4 account");
        }
        if (supplier != null && !belongsToOrganization(supplier.getOrganization())) {
            throw new IllegalArgumentException("Supplier must belong to the supplier account organization");
        }
    }

    private boolean belongsToOrganization(Organization associatedOrganization) {
        return organization == associatedOrganization
                || organization.getOrganizationId() != null
                && associatedOrganization != null
                && organization.getOrganizationId().equals(associatedOrganization.getOrganizationId());
    }

    public Long getSupplierAccountId() {
        return supplierAccountId;
    }

    public void setSupplierAccountId(Long supplierAccountId) {
        this.supplierAccountId = supplierAccountId;
    }

    public Organization getOrganization() {
        return organization;
    }

    public void setOrganization(Organization organization) {
        this.organization = organization;
    }

    public ChartOfAccount getCollectiveAccount() {
        return collectiveAccount;
    }

    public void setCollectiveAccount(ChartOfAccount collectiveAccount) {
        this.collectiveAccount = collectiveAccount;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
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
