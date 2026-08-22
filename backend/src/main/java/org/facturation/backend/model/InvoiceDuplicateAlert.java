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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_duplicate_alerts")
public class InvoiceDuplicateAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long duplicateAlertId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "matching_invoice_id", nullable = false)
    private Invoice matchingInvoice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DuplicateAlertType alertType;

    @Column(nullable = false)
    private LocalDate invoiceDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalTtc;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public Long getDuplicateAlertId() {
        return duplicateAlertId;
    }

    public Invoice getInvoice() {
        return invoice;
    }

    public void setInvoice(Invoice invoice) {
        this.invoice = invoice;
    }

    public Invoice getMatchingInvoice() {
        return matchingInvoice;
    }

    public void setMatchingInvoice(Invoice matchingInvoice) {
        this.matchingInvoice = matchingInvoice;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public DuplicateAlertType getAlertType() {
        return alertType;
    }

    public void setAlertType(DuplicateAlertType alertType) {
        this.alertType = alertType;
    }

    public LocalDate getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(LocalDate invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public BigDecimal getTotalTtc() {
        return totalTtc;
    }

    public void setTotalTtc(BigDecimal totalTtc) {
        this.totalTtc = totalTtc;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
