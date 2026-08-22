package org.facturation.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "invoice_validation_decisions")
public class InvoiceValidationDecision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceValidationDecisionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InvoiceValidationDecisionType decisionType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "decided_by_user_id", nullable = false)
    private User decidedByUser;

    @Column(nullable = false)
    private LocalDateTime decidedAt;

    private String reason;

    public Long getInvoiceValidationDecisionId() {
        return invoiceValidationDecisionId;
    }

    public void setInvoiceValidationDecisionId(Long invoiceValidationDecisionId) {
        this.invoiceValidationDecisionId = invoiceValidationDecisionId;
    }

    public Invoice getInvoice() {
        return invoice;
    }

    public void setInvoice(Invoice invoice) {
        this.invoice = invoice;
    }

    public InvoiceValidationDecisionType getDecisionType() {
        return decisionType;
    }

    public void setDecisionType(InvoiceValidationDecisionType decisionType) {
        this.decisionType = decisionType;
    }

    public User getDecidedByUser() {
        return decidedByUser;
    }

    public void setDecidedByUser(User decidedByUser) {
        this.decidedByUser = decidedByUser;
    }

    public LocalDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(LocalDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
