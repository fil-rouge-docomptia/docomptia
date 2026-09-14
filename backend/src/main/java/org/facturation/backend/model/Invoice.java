package org.facturation.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoices")
@SQLRestriction("deleted_at IS NULL")
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "classification_id")
    private Classification classification;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_status_id", nullable = false)
    private InvoiceStatus invoiceStatus;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id")
    private User assignedUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "paid_by_user_id")
    private User paidByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "export_batch_id")
    private ExportBatch exportBatch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @ColumnDefault("'MANUAL_UPLOAD'")
    private InvoiceOrigin origin = InvoiceOrigin.MANUAL_UPLOAD;

    private String invoiceNumber;

    private String commandReference;

    private LocalDate invoiceDate;

    private LocalDate dueDate;

    private LocalDate paymentDate;

    private String paymentReference;

    private LocalDateTime archivedAt;

    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deleted_by_user_id")
    private User deletedByUser;

    @Column(length = 1000)
    private String deletionReason;

    @Column(nullable = false, length = 3)
    private String currencyCode;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalHt;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalTva;

    @Column(precision = 12, scale = 2)
    private BigDecimal totalTtc;

    private String description;

    private String supplierLegalNameSnapshot;
    private String supplierAddressSnapshot;
    private String supplierIdentifiersSnapshot;
    private Boolean supplierMatchConfirmed;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public Long getInvoiceId() {
        return invoiceId;
    }

    public void setInvoiceId(Long invoiceId) {
        this.invoiceId = invoiceId;
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

    public Client getClient() {
        return client;
    }

    public void setClient(Client client) {
        this.client = client;
    }

    public Classification getClassification() { return classification; }

    public void setClassification(Classification classification) { this.classification = classification; }

    public InvoiceStatus getInvoiceStatus() {
        return invoiceStatus;
    }

    public void setInvoiceStatus(InvoiceStatus invoiceStatus) {
        this.invoiceStatus = invoiceStatus;
    }

    public User getCreatedByUser() {
        return createdByUser;
    }

    public void setCreatedByUser(User createdByUser) {
        this.createdByUser = createdByUser;
    }

    public User getAssignedUser() {
        return assignedUser;
    }

    public void setAssignedUser(User assignedUser) {
        this.assignedUser = assignedUser;
    }

    public User getPaidByUser() {
        return paidByUser;
    }

    public void setPaidByUser(User paidByUser) {
        this.paidByUser = paidByUser;
    }

    public ExportBatch getExportBatch() {
        return exportBatch;
    }

    public void setExportBatch(ExportBatch exportBatch) {
        this.exportBatch = exportBatch;
    }

    public InvoiceOrigin getOrigin() {
        return origin;
    }

    public void setOrigin(InvoiceOrigin origin) {
        this.origin = origin;
    }

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

    public LocalDate getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(LocalDate invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public LocalDateTime getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(LocalDateTime archivedAt) {
        this.archivedAt = archivedAt;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    public User getDeletedByUser() {
        return deletedByUser;
    }

    public void setDeletedByUser(User deletedByUser) {
        this.deletedByUser = deletedByUser;
    }

    public String getDeletionReason() {
        return deletionReason;
    }

    public void setDeletionReason(String deletionReason) {
        this.deletionReason = deletionReason;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public void setCurrencyCode(String currencyCode) {
        this.currencyCode = currencyCode;
    }

    public BigDecimal getTotalHt() {
        return totalHt;
    }

    public void setTotalHt(BigDecimal totalHt) {
        this.totalHt = totalHt;
    }

    public BigDecimal getTotalTva() {
        return totalTva;
    }

    public void setTotalTva(BigDecimal totalTva) {
        this.totalTva = totalTva;
    }

    public BigDecimal getTotalTtc() {
        return totalTtc;
    }

    public void setTotalTtc(BigDecimal totalTtc) {
        this.totalTtc = totalTtc;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSupplierLegalNameSnapshot() { return supplierLegalNameSnapshot; }
    public void setSupplierLegalNameSnapshot(String value) { this.supplierLegalNameSnapshot = value; }
    public String getSupplierAddressSnapshot() { return supplierAddressSnapshot; }
    public void setSupplierAddressSnapshot(String value) { this.supplierAddressSnapshot = value; }
    public String getSupplierIdentifiersSnapshot() { return supplierIdentifiersSnapshot; }
    public void setSupplierIdentifiersSnapshot(String value) { this.supplierIdentifiersSnapshot = value; }
    public Boolean getSupplierMatchConfirmed() { return supplierMatchConfirmed; }
    public void setSupplierMatchConfirmed(Boolean value) { this.supplierMatchConfirmed = value; }

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
