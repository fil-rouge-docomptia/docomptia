package org.facturation.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "invoice_statuses")
public class InvoiceStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long invoiceStatusId;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String label;

    private String description;

    public Long getInvoiceStatusId() {
        return invoiceStatusId;
    }

    public void setInvoiceStatusId(Long invoiceStatusId) {
        this.invoiceStatusId = invoiceStatusId;
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
