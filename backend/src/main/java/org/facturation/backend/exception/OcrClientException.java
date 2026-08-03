package org.facturation.backend.exception;

import org.facturation.backend.model.OcrErrorCode;

public class OcrClientException extends IllegalStateException {

    private final OcrErrorCode errorCode;

    public OcrClientException(OcrErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public OcrClientException(OcrErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public OcrErrorCode getErrorCode() {
        return errorCode;
    }
}
