package org.facturation.backend.model;

public enum OcrErrorCode {
    SERVICE_UNAVAILABLE("OCR_SERVICE_UNAVAILABLE"),
    SERVICE_REJECTED("OCR_SERVICE_REJECTED"),
    INVALID_RESPONSE("OCR_INVALID_RESPONSE"),
    CALL_INTERRUPTED("OCR_CALL_INTERRUPTED"),
    FILE_READ_FAILED("OCR_FILE_READ_FAILED"),
    PROCESSING_FAILED("OCR_PROCESSING_FAILED");

    private final String code;

    OcrErrorCode(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
