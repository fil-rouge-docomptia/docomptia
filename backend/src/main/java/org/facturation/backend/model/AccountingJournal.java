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
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "accounting_journals", uniqueConstraints = @UniqueConstraint(
        name = "uk_accounting_journals_organization_code", columnNames = {"organization_id", "code"}))
public class AccountingJournal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long accountingJournalId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(nullable = false)
    private String code;
    @Column(nullable = false)
    private String label;
    @Column(nullable = false)
    private boolean active;

    public Long getAccountingJournalId() { return accountingJournalId; }
    public void setAccountingJournalId(Long id) { accountingJournalId = id; }
    public Organization getOrganization() { return organization; }
    public void setOrganization(Organization organization) { this.organization = organization; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
