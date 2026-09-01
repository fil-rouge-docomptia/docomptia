package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Champs corrigeables d'une facture extraite. Au moins un champ doit etre fourni et modifier une valeur.")
public class InvoiceCorrectionRequest {

    @Schema(description = "Numero de facture corrige", example = "FAC-2026-001")
    private String invoiceNumber;
    @Schema(description = "Reference de commande corrigee. Une chaine vide supprime la valeur.", example = "CMD-2026-042")
    private String commandReference;
    @Schema(description = "Date de facture corrigee au format ISO", example = "2026-08-07")
    private String invoiceDate;
    @Schema(description = "Date d'echeance corrigee au format ISO. Une chaine vide supprime la valeur.", example = "2026-09-06")
    private String dueDate;
    @Schema(description = "Montant HT corrige avec deux decimales", example = "100.00")
    private String totalHt;
    @Schema(description = "Montant de TVA corrige avec deux decimales", example = "20.00")
    private String totalTva;
    @Schema(description = "Montant TTC corrige avec deux decimales", example = "120.00")
    private String totalTtc;
    @Schema(description = "Nom ou raison sociale d'un fournisseur existant dans l'organisation courante", example = "Orange")
    private String supplierName;
    @Schema(description = "Identifiant canonique du fournisseur selectionne manuellement", example = "1")
    private Long supplierId;

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

    public String getInvoiceDate() {
        return invoiceDate;
    }

    public void setInvoiceDate(String invoiceDate) {
        this.invoiceDate = invoiceDate;
    }

    public String getDueDate() {
        return dueDate;
    }

    public void setDueDate(String dueDate) {
        this.dueDate = dueDate;
    }

    public String getTotalHt() {
        return totalHt;
    }

    public void setTotalHt(String totalHt) {
        this.totalHt = totalHt;
    }

    public String getTotalTva() {
        return totalTva;
    }

    public void setTotalTva(String totalTva) {
        this.totalTva = totalTva;
    }

    public String getTotalTtc() {
        return totalTtc;
    }

    public void setTotalTtc(String totalTtc) {
        this.totalTtc = totalTtc;
    }

    public String getSupplierName() {
        return supplierName;
    }

    public void setSupplierName(String supplierName) {
        this.supplierName = supplierName;
    }

    public Long getSupplierId() { return supplierId; }
    public void setSupplierId(Long supplierId) { this.supplierId = supplierId; }
}
