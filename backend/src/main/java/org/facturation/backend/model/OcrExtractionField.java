package org.facturation.backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ocr_extraction_fields")
public class OcrExtractionField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long ocrExtractionFieldId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ocr_extraction_id", nullable = false)
    private OcrExtraction ocrExtraction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_user_id")
    private User correctedByUser;

    private String fieldName;

    private String rawValue;

    private String normalizedValue;

    private BigDecimal confidenceScore;

    private boolean isCorrected;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public Long getOcrExtractionFieldId() {
        return ocrExtractionFieldId;
    }

    public void setOcrExtractionFieldId(Long ocrExtractionFieldId) {
        this.ocrExtractionFieldId = ocrExtractionFieldId;
    }

    public OcrExtraction getOcrExtraction() {
        return ocrExtraction;
    }

    public void setOcrExtraction(OcrExtraction ocrExtraction) {
        this.ocrExtraction = ocrExtraction;
    }

    public User getCorrectedByUser() {
        return correctedByUser;
    }

    public void setCorrectedByUser(User correctedByUser) {
        this.correctedByUser = correctedByUser;
    }

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

    public BigDecimal getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(BigDecimal confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public boolean isCorrected() {
        return isCorrected;
    }

    public void setCorrected(boolean corrected) {
        isCorrected = corrected;
    }

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
