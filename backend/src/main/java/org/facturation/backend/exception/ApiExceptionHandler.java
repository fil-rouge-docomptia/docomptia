package org.facturation.backend.exception;

import org.facturation.backend.dto.response.ApiErrorResponse;
import org.facturation.backend.dto.response.InvoiceMissingRequiredFieldsResponse;
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
    private static final String SUPPLIER_VALIDATION_ERROR_CODE = "SUPPLIER_VALIDATION_ERROR";
    private static final String SUPPLIER_LEGAL_IDENTIFIER_CONFLICT_CODE = "SUPPLIER_LEGAL_IDENTIFIER_CONFLICT";
    private static final String CHART_OF_ACCOUNT_NOT_FOUND_CODE = "CHART_OF_ACCOUNT_NOT_FOUND";
    private static final String CHART_OF_ACCOUNT_VALIDATION_ERROR_CODE = "CHART_OF_ACCOUNT_VALIDATION_ERROR";
    private static final String CHART_OF_ACCOUNT_CONFLICT_CODE = "CHART_OF_ACCOUNT_CONFLICT";
    private static final String INVOICE_ACTION_NOT_ALLOWED_CODE = "INVOICE_ACTION_NOT_ALLOWED";
    private static final String INVOICE_REQUIRED_FIELDS_MISSING_CODE = "INVOICE_REQUIRED_FIELDS_MISSING";
    private static final String DUPLICATE_ALERT_NOT_FOUND_CODE = "DUPLICATE_ALERT_NOT_FOUND";
    private static final String DUPLICATE_ALERT_ACTION_NOT_ALLOWED_CODE = "DUPLICATE_ALERT_ACTION_NOT_ALLOWED";

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

    @ExceptionHandler(InvalidSupplierException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidSupplier(InvalidSupplierException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, SUPPLIER_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(SupplierLegalIdentifierConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleSupplierLegalIdentifierConflict(
            SupplierLegalIdentifierConflictException exception
    ) {
        return errorResponse(
                HttpStatus.CONFLICT,
                SUPPLIER_LEGAL_IDENTIFIER_CONFLICT_CODE,
                exception.getMessage()
        );
    }

    @ExceptionHandler(ChartOfAccountNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleChartOfAccountNotFound(ChartOfAccountNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, CHART_OF_ACCOUNT_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvalidChartOfAccountException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidChartOfAccount(InvalidChartOfAccountException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, CHART_OF_ACCOUNT_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(ChartOfAccountConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleChartOfAccountConflict(ChartOfAccountConflictException exception) {
        return errorResponse(HttpStatus.CONFLICT, CHART_OF_ACCOUNT_CONFLICT_CODE, exception.getMessage());
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
        InvoiceMissingRequiredFieldsResponse response = new InvoiceMissingRequiredFieldsResponse(
                INVOICE_REQUIRED_FIELDS_MISSING_CODE,
                exception.getMessage(),
                exception.getMissingFields()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(DuplicateAlertNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateAlertNotFound(DuplicateAlertNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, DUPLICATE_ALERT_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(DuplicateAlertDecisionException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateAlertDecision(DuplicateAlertDecisionException exception) {
        return errorResponse(HttpStatus.CONFLICT, DUPLICATE_ALERT_ACTION_NOT_ALLOWED_CODE, exception.getMessage());
    }

    @ExceptionHandler(PendingDuplicateAlertException.class)
    public ResponseEntity<ApiErrorResponse> handlePendingDuplicateAlert(PendingDuplicateAlertException exception) {
        return errorResponse(HttpStatus.CONFLICT, DUPLICATE_ALERT_ACTION_NOT_ALLOWED_CODE, exception.getMessage());
    }

    private ResponseEntity<ApiErrorResponse> errorResponse(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(code, message));
    }
}
