package org.facturation.backend.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public class OcrFieldResponse {

    private String fieldName;
    private String rawValue;
    private String normalizedValue;
    private String confidenceScore;
    @Schema(
            description = "Vaut true lorsque la valeur normalisee du champ provient d'une correction manuelle",
            example = "false"
    )
    private boolean corrected;

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getRawValue() {
        return rawValue;
    }

    public void setRawValue(String rawValue) {
        this.rawValue = rawValue;
    }

    public String getNormalizedValue() {
        return normalizedValue;
    }

    public void setNormalizedValue(String normalizedValue) {
        this.normalizedValue = normalizedValue;
    }

    public String getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(String confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public boolean isCorrected() {
        return corrected;
    }

    public void setCorrected(boolean corrected) {
        this.corrected = corrected;
    }
}
