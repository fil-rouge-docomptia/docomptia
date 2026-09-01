package org.facturation.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "supplier_legal_identifiers")
public class SupplierLegalIdentifier {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long supplierLegalIdentifierId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SupplierLegalIdentifierType type;
    @Column(nullable = false, length = 40)
    private String scheme;
    @Column(nullable = false, length = 2)
    private String countryCode;
    @Column(name = "raw_value", nullable = false)
    private String value;
    @Column(nullable = false)
    private String normalizedValue;
    private LocalDate validFrom;
    private LocalDate validTo;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SupplierLegalIdentifierSource source;
    @Column(nullable = false)
    private boolean verified;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdByUser;
    private String changeReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Long getSupplierLegalIdentifierId() { return supplierLegalIdentifierId; }
    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }
    public Supplier getSupplier() { return supplier; }
    public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public SupplierLegalIdentifierType getType() { return type; }
    public void setType(SupplierLegalIdentifierType type) { this.type = type; }
    public String getScheme() { return scheme; }
    public void setScheme(String scheme) { this.scheme = scheme; }
    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public String getNormalizedValue() { return normalizedValue; }
    public void setNormalizedValue(String normalizedValue) { this.normalizedValue = normalizedValue; }
    public LocalDate getValidFrom() { return validFrom; }
    public void setValidFrom(LocalDate validFrom) { this.validFrom = validFrom; }
    public LocalDate getValidTo() { return validTo; }
    public void setValidTo(LocalDate validTo) { this.validTo = validTo; }
    public SupplierLegalIdentifierSource getSource() { return source; }
    public void setSource(SupplierLegalIdentifierSource source) { this.source = source; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public User getCreatedByUser() { return createdByUser; }
    public void setCreatedByUser(User createdByUser) { this.createdByUser = createdByUser; }
    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
