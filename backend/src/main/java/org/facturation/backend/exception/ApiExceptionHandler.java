package org.facturation.backend.exception;

import org.facturation.backend.dto.response.ApiErrorResponse;
import org.facturation.backend.dto.response.InvoiceOcrFailureResponse;
import org.facturation.backend.mapper.OcrErrorMapper;
import org.facturation.backend.model.InvoiceStatusCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final String INVALID_INVOICE_FILE_CODE = "INVALID_INVOICE_FILE";
    private static final String INVOICE_VALIDATION_ERROR_CODE = "INVOICE_VALIDATION_ERROR";
    private static final String INVOICE_NOT_FOUND_CODE = "INVOICE_NOT_FOUND";
    private static final String SUPPLIER_NOT_FOUND_CODE = "SUPPLIER_NOT_FOUND";
    private static final String INVOICE_ACTION_NOT_ALLOWED_CODE = "INVOICE_ACTION_NOT_ALLOWED";
    private static final String INVOICE_REQUIRED_FIELDS_MISSING_CODE = "INVOICE_REQUIRED_FIELDS_MISSING";

    private final OcrErrorMapper ocrErrorMapper;

    public ApiExceptionHandler(OcrErrorMapper ocrErrorMapper) {
        this.ocrErrorMapper = ocrErrorMapper;
    }

    @ExceptionHandler(InvalidInvoiceFileException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidInvoiceFile(InvalidInvoiceFileException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, INVALID_INVOICE_FILE_CODE, exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, INVOICE_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleInvoiceNotFound(InvoiceNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, INVOICE_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(SupplierNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleSupplierNotFound(SupplierNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, SUPPLIER_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceOcrFailureException.class)
    public ResponseEntity<InvoiceOcrFailureResponse> handleInvoiceOcrFailure(
            InvoiceOcrFailureException exception
    ) {
        InvoiceOcrFailureResponse response = new InvoiceOcrFailureResponse();
        response.setInvoiceId(exception.getInvoiceId());
        response.setStatus(InvoiceStatusCode.ERREUR_OCR.getCode());
        response.setOcrError(ocrErrorMapper.toResponse(exception.getOcrError()));
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
    }

    @ExceptionHandler(OcrRetryNotAllowedException.class)
    public ResponseEntity<ApiErrorResponse> handleOcrRetryNotAllowed(OcrRetryNotAllowedException exception) {
        return errorResponse(HttpStatus.CONFLICT, INVOICE_ACTION_NOT_ALLOWED_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceStatusTransitionException.class)
    public ResponseEntity<ApiErrorResponse> handleInvoiceStatusTransition(
            InvoiceStatusTransitionException exception
    ) {
        return errorResponse(HttpStatus.CONFLICT, INVOICE_ACTION_NOT_ALLOWED_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceMissingRequiredFieldsException.class)
    public ResponseEntity<ApiErrorResponse> handleInvoiceMissingRequiredFields(
            InvoiceMissingRequiredFieldsException exception
    ) {
        return errorResponse(
                HttpStatus.CONFLICT,
                INVOICE_REQUIRED_FIELDS_MISSING_CODE,
                exception.getMessage()
        );
    }

    private ResponseEntity<ApiErrorResponse> errorResponse(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(code, message));
    }
}
