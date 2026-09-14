package org.facturation.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "accounting_entry_mutations", uniqueConstraints = @UniqueConstraint(
        name = "uk_accounting_entry_mutation_key", columnNames = {"accounting_entry_id", "request_key"}))
public class AccountingEntryMutation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long accountingEntryMutationId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "accounting_entry_id", nullable = false)
    private AccountingEntry accountingEntry;
    @Column(nullable = false, length = 36)
    private String requestKey;
    @Column(nullable = false, length = 64)
    private String fingerprint;
    public Long getAccountingEntryMutationId() { return accountingEntryMutationId; }
    public void setAccountingEntryMutationId(Long value) { accountingEntryMutationId = value; }
    public AccountingEntry getAccountingEntry() { return accountingEntry; }
    public void setAccountingEntry(AccountingEntry value) { accountingEntry = value; }
    public String getRequestKey() { return requestKey; }
    public void setRequestKey(String value) { requestKey = value; }
    public String getFingerprint() { return fingerprint; }
    public void setFingerprint(String value) { fingerprint = value; }
}
