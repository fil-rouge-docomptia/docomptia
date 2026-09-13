package org.facturation.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "accounting_entries")
public class AccountingEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long accountingEntryId;

    @jakarta.persistence.Version
    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long version;

    public Long getVersion() { return version; }


    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accounting_journal_id")
    private AccountingJournal journal;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "export_batch_id")
    private ExportBatch exportBatch;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reversed_accounting_entry_id", unique = true)
    private AccountingEntry reversedAccountingEntry;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @Column(nullable = false)
    private String entryNumber;

    @Column(nullable = false)
    private LocalDate entryDate;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void validateOrganizationReferences() {
        if (invoice == null || invoice.getOrganization() == null) {
            return;
        }
        Long organizationId = invoice.getOrganization().getOrganizationId();
        if (journal != null && (journal.getOrganization() == null
                || !java.util.Objects.equals(organizationId, journal.getOrganization().getOrganizationId()))) {
            throw new IllegalArgumentException("Journal must belong to the accounting entry organization");
        }
        if (exportBatch != null && (exportBatch.getOrganization() == null
                || !java.util.Objects.equals(organizationId, exportBatch.getOrganization().getOrganizationId()))) {
            throw new IllegalArgumentException("Export batch must belong to the accounting entry organization");
        }
    }

    public AccountingJournal getJournal() { return journal; }
    public void setJournal(AccountingJournal journal) { this.journal = journal; }
    public ExportBatch getExportBatch() { return exportBatch; }
    public void setExportBatch(ExportBatch exportBatch) { this.exportBatch = exportBatch; }

    public Long getAccountingEntryId() {
        return accountingEntryId;
    }

    public void setAccountingEntryId(Long accountingEntryId) {
        this.accountingEntryId = accountingEntryId;
    }

    public Invoice getInvoice() {
        return invoice;
    }

    public void setInvoice(Invoice invoice) {
        this.invoice = invoice;
    }

    public AccountingEntry getReversedAccountingEntry() {
        return reversedAccountingEntry;
    }

    public void setReversedAccountingEntry(AccountingEntry reversedAccountingEntry) {
        this.reversedAccountingEntry = reversedAccountingEntry;
    }

    public User getCreatedByUser() {
        return createdByUser;
    }

    public void setCreatedByUser(User createdByUser) {
        this.createdByUser = createdByUser;
    }

    public String getEntryNumber() {
        return entryNumber;
    }

    public void setEntryNumber(String entryNumber) {
        this.entryNumber = entryNumber;
    }

    public LocalDate getEntryDate() {
        return entryDate;
    }

    public void setEntryDate(LocalDate entryDate) {
        this.entryDate = entryDate;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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
