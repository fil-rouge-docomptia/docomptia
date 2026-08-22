package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Comptes a utiliser pour une regle comptable")
public class AccountingRuleUpdateRequest {
    private Long expenseAccountId;
    private Long vatAccountId;
    private Long supplierAccountId;

    public Long getExpenseAccountId() { return expenseAccountId; }
    public void setExpenseAccountId(Long expenseAccountId) { this.expenseAccountId = expenseAccountId; }
    public Long getVatAccountId() { return vatAccountId; }
    public void setVatAccountId(Long vatAccountId) { this.vatAccountId = vatAccountId; }
    public Long getSupplierAccountId() { return supplierAccountId; }
    public void setSupplierAccountId(Long supplierAccountId) { this.supplierAccountId = supplierAccountId; }
}
