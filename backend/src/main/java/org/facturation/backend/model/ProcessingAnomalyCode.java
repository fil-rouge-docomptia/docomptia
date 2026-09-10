package org.facturation.backend.model;

import java.util.Arrays;

public enum ProcessingAnomalyCode {

    OCR_INCOMPLETE(
            "OCR incomplet",
            "Certaines informations obligatoires n'ont pas pu être extraites du document."
    ),
    INVALID_VAT(
            "TVA invalide",
            "Les informations de TVA de la facture ne respectent pas les règles attendues."
    ),
    INCONSISTENT_AMOUNTS(
            "Incohérence HT/TVA/TTC",
            "Le montant TTC ne correspond pas à la somme des montants HT et TVA."
    ),
    SUSPECTED_DUPLICATE(
            "Doublon suspect",
            "La facture ressemble à une autre facture déjà enregistrée."
    ),
    MISSING_THIRD_PARTY_ACCOUNT(
            "Compte de tiers manquant",
            "Aucun compte de tiers n'est disponible pour comptabiliser cette facture."
    ),
    UNBALANCED_ACCOUNTING_ENTRY(
            "Écriture déséquilibrée",
            "Le total des débits de l'écriture ne correspond pas au total des crédits."
    ),
    EXPORT_ERROR(
            "Erreur d'export",
            "La facture n'a pas pu être exportée vers le format comptable demandé."
    );

    private final String label;
    private final String description;

    ProcessingAnomalyCode(String label, String description) {
        this.label = label;
        this.description = description;
    }

    public String getCode() {
        return name();
    }

    public String getLabel() {
        return label;
    }

    public String getDescription() {
        return description;
    }

    public static ProcessingAnomalyCode fromCode(String code) {
        return Arrays.stream(values())
                .filter(value -> value.getCode().equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown processing anomaly code: " + code));
    }
}
