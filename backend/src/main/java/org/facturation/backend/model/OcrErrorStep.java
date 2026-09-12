package org.facturation.backend.model;

public enum OcrErrorStep {
    FILE_STORAGE,
    OCR_ANALYSIS,
    SUPPLIER_RESOLUTION,
    EXTRACTION_PERSISTENCE,
    STATUS_UPDATE
}
