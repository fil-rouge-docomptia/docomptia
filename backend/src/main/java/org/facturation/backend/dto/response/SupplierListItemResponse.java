package org.facturation.backend.dto.response;

public class SupplierListItemResponse {

    private Long supplierId;
    private String name;
    private String legalName;
    private String siret;
    private String vatNumber;
    private String tradeName;
    private String countryCode;
    private java.util.List<SupplierLegalIdentifierResponse> currentLegalIdentifiers = java.util.List.of();

    public Long getSupplierId() {
        return supplierId;
    }

    public void setSupplierId(Long supplierId) {
        this.supplierId = supplierId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLegalName() {
        return legalName;
    }

    public void setLegalName(String legalName) {
        this.legalName = legalName;
    }

    public String getSiret() {
        return siret;
    }

    public void setSiret(String siret) {
        this.siret = siret;
    }

    public String getVatNumber() {
        return vatNumber;
    }

    public void setVatNumber(String vatNumber) {
        this.vatNumber = vatNumber;
    }

    public String getTradeName() { return tradeName; }
    public void setTradeName(String tradeName) { this.tradeName = tradeName; }
    public String getCountryCode() { return countryCode; }
    public void setCountryCode(String countryCode) { this.countryCode = countryCode; }
    public java.util.List<SupplierLegalIdentifierResponse> getCurrentLegalIdentifiers() { return currentLegalIdentifiers; }
    public void setCurrentLegalIdentifiers(java.util.List<SupplierLegalIdentifierResponse> identifiers) { this.currentLegalIdentifiers = identifiers; }
}
