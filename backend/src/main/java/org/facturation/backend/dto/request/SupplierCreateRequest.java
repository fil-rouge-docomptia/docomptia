package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Fournisseur a ajouter a l'organisation")
public class SupplierCreateRequest {

    @Schema(description = "Nom usuel", example = "Orange Business")
    private String name;
    @Schema(description = "Raison sociale", example = "Orange SA")
    private String legalName;
    @Schema(description = "SIRET francais", example = "38012986600014")
    private String siret;
    @Schema(description = "Numero de TVA", example = "FR89380129866")
    private String vatNumber;
    private String email;
    private String phone;
    private String address;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getLegalName() { return legalName; }
    public void setLegalName(String legalName) { this.legalName = legalName; }
    public String getSiret() { return siret; }
    public void setSiret(String siret) { this.siret = siret; }
    public String getVatNumber() { return vatNumber; }
    public void setVatNumber(String vatNumber) { this.vatNumber = vatNumber; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
}
