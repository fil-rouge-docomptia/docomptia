package org.facturation.backend.exception;

import org.facturation.backend.dto.response.AccountingEntryPrerequisitesResponse;
import org.facturation.backend.dto.response.AccountingExportValidationResponse;
import org.facturation.backend.dto.response.ApiErrorResponse;
import org.facturation.backend.dto.response.InvoiceMissingRequiredFieldsResponse;
import org.facturation.backend.dto.response.InvoiceOcrFailureResponse;
import org.facturation.backend.dto.response.UnbalancedAccountingEntryResponse;
import org.facturation.backend.mapper.OcrErrorMapper;
import org.facturation.backend.model.InvoiceStatusCode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final String INVALID_INVOICE_FILE_CODE = "INVALID_INVOICE_FILE";
    private static final String INVOICE_FILE_NOT_FOUND_CODE = "INVOICE_FILE_NOT_FOUND";
    private static final String INVOICE_FILE_NOT_PREVIEWABLE_CODE = "INVOICE_FILE_NOT_PREVIEWABLE";
    private static final String INVOICE_VALIDATION_ERROR_CODE = "INVOICE_VALIDATION_ERROR";
    private static final String INVOICE_NOT_FOUND_CODE = "INVOICE_NOT_FOUND";
    private static final String NOTIFICATION_NOT_FOUND_CODE = "NOTIFICATION_NOT_FOUND";
    private static final String SUPPLIER_NOT_FOUND_CODE = "SUPPLIER_NOT_FOUND";
    private static final String SUPPLIER_VALIDATION_ERROR_CODE = "SUPPLIER_VALIDATION_ERROR";
    private static final String SUPPLIER_LEGAL_IDENTIFIER_CONFLICT_CODE = "SUPPLIER_LEGAL_IDENTIFIER_CONFLICT";
    private static final String CHART_OF_ACCOUNT_NOT_FOUND_CODE = "CHART_OF_ACCOUNT_NOT_FOUND";
    private static final String CHART_OF_ACCOUNT_VALIDATION_ERROR_CODE = "CHART_OF_ACCOUNT_VALIDATION_ERROR";
    private static final String CHART_OF_ACCOUNT_CONFLICT_CODE = "CHART_OF_ACCOUNT_CONFLICT";
    private static final String INVOICE_ACTION_NOT_ALLOWED_CODE = "INVOICE_ACTION_NOT_ALLOWED";
    private static final String ARCHIVED_INVOICE_NOT_MODIFIABLE_CODE = "ARCHIVED_INVOICE_NOT_MODIFIABLE";
    private static final String EXPORTED_INVOICE_NOT_MODIFIABLE_CODE = "EXPORTED_INVOICE_NOT_MODIFIABLE";
    private static final String INVOICE_REQUIRED_FIELDS_MISSING_CODE = "INVOICE_REQUIRED_FIELDS_MISSING";
    private static final String DUPLICATE_ALERT_NOT_FOUND_CODE = "DUPLICATE_ALERT_NOT_FOUND";
    private static final String DUPLICATE_ALERT_ACTION_NOT_ALLOWED_CODE = "DUPLICATE_ALERT_ACTION_NOT_ALLOWED";
    private static final String ACCOUNTING_RULE_NOT_FOUND_CODE = "ACCOUNTING_RULE_NOT_FOUND";
    private static final String ACCOUNTING_RULE_VALIDATION_ERROR_CODE = "ACCOUNTING_RULE_VALIDATION_ERROR";
    private static final String ACCOUNTING_ENTRY_PREREQUISITES_MISSING_CODE =
            "ACCOUNTING_ENTRY_PREREQUISITES_MISSING";
    private static final String ACCOUNTING_ENTRY_LINE_NOT_FOUND_CODE = "ACCOUNTING_ENTRY_LINE_NOT_FOUND";
    private static final String ACCOUNTING_ENTRY_NOT_FOUND_CODE = "ACCOUNTING_ENTRY_NOT_FOUND";
    private static final String ACCOUNTING_ENTRY_REVERSAL_NOT_ALLOWED_CODE =
            "ACCOUNTING_ENTRY_REVERSAL_NOT_ALLOWED";
    private static final String ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR_CODE =
            "ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR";
    private static final String ACCOUNTING_ENTRY_NOT_MODIFIABLE_CODE = "ACCOUNTING_ENTRY_NOT_MODIFIABLE";
    private static final String ACCOUNTING_ENTRY_UNBALANCED_CODE = "ACCOUNTING_ENTRY_UNBALANCED";
    private static final String ACCOUNTING_EXPORT_VALIDATION_FAILED_CODE = "ACCOUNTING_EXPORT_VALIDATION_FAILED";
    private static final String ACCOUNTING_EXPORT_FILE_NOT_FOUND_CODE = "ACCOUNTING_EXPORT_FILE_NOT_FOUND";
    private static final String INVALID_CREDENTIALS_CODE = "INVALID_CREDENTIALS";
    private static final String USER_VALIDATION_ERROR_CODE = "USER_VALIDATION_ERROR";
    private static final String USER_EMAIL_CONFLICT_CODE = "USER_EMAIL_CONFLICT";
    private static final String USER_NOT_FOUND_CODE = "USER_NOT_FOUND";
    private static final String LAST_ACTIVE_ADMINISTRATOR_CODE = "LAST_ACTIVE_ADMINISTRATOR";
    private static final String REGISTRATION_VALIDATION_ERROR_CODE = "REGISTRATION_VALIDATION_ERROR";
    private static final String ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT_CODE =
            "ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT";
    private static final String ORGANIZATION_VALIDATION_ERROR_CODE = "ORGANIZATION_VALIDATION_ERROR";
    private static final String CLASSIFICATION_NOT_FOUND_CODE = "CLASSIFICATION_NOT_FOUND";
    private static final String CLASSIFICATION_VALIDATION_ERROR_CODE = "CLASSIFICATION_VALIDATION_ERROR";
    private static final String CLASSIFICATION_CONFLICT_CODE = "CLASSIFICATION_CONFLICT";

    private final OcrErrorMapper ocrErrorMapper;

    public ApiExceptionHandler(OcrErrorMapper ocrErrorMapper) {
        this.ocrErrorMapper = ocrErrorMapper;
    }

    @ExceptionHandler(InvalidInvoiceFileException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidInvoiceFile(InvalidInvoiceFileException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, INVALID_INVOICE_FILE_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceFileNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleInvoiceFileNotFound(InvoiceFileNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, INVOICE_FILE_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceFileNotPreviewableException.class)
    public ResponseEntity<ApiErrorResponse> handleInvoiceFileNotPreviewable(
            InvoiceFileNotPreviewableException exception
    ) {
        return errorResponse(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                INVOICE_FILE_NOT_PREVIEWABLE_CODE,
                exception.getMessage()
        );
    }

    @ExceptionHandler(InvalidLoginException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidLogin(InvalidLoginException exception) {
        return errorResponse(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvalidUserException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidUser(InvalidUserException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, USER_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(UserEmailConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleUserEmailConflict(UserEmailConflictException exception) {
        return errorResponse(HttpStatus.CONFLICT, USER_EMAIL_CONFLICT_CODE, exception.getMessage());
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleUserNotFound(UserNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, USER_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(LastActiveAdministratorException.class)
    public ResponseEntity<ApiErrorResponse> handleLastActiveAdministrator(
            LastActiveAdministratorException exception
    ) {
        return errorResponse(HttpStatus.CONFLICT, LAST_ACTIVE_ADMINISTRATOR_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvalidRegistrationException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidRegistration(InvalidRegistrationException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, REGISTRATION_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(OrganizationLegalIdentifierConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationLegalIdentifierConflict(
            OrganizationLegalIdentifierConflictException exception
    ) {
        return errorResponse(
                HttpStatus.CONFLICT,
                ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT_CODE,
                exception.getMessage()
        );
    }

    @ExceptionHandler(InvalidOrganizationException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidOrganization(InvalidOrganizationException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, ORGANIZATION_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(ClassificationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleClassificationNotFound(ClassificationNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, CLASSIFICATION_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvalidClassificationException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidClassification(InvalidClassificationException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, CLASSIFICATION_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(ClassificationConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleClassificationConflict(ClassificationConflictException exception) {
        return errorResponse(HttpStatus.CONFLICT, CLASSIFICATION_CONFLICT_CODE, exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, INVOICE_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvoiceNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleInvoiceNotFound(InvoiceNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, INVOICE_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(NotificationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotificationNotFound(NotificationNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, NOTIFICATION_NOT_FOUND_CODE, exception.getMessage());
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

    @ExceptionHandler(ArchivedInvoiceNotModifiableException.class)
    public ResponseEntity<ApiErrorResponse> handleArchivedInvoiceNotModifiable(
            ArchivedInvoiceNotModifiableException exception
    ) {
        return errorResponse(HttpStatus.CONFLICT, ARCHIVED_INVOICE_NOT_MODIFIABLE_CODE, exception.getMessage());
    }

    @ExceptionHandler(ExportedInvoiceNotModifiableException.class)
    public ResponseEntity<ApiErrorResponse> handleExportedInvoiceNotModifiable(
            ExportedInvoiceNotModifiableException exception
    ) {
        return errorResponse(HttpStatus.CONFLICT, EXPORTED_INVOICE_NOT_MODIFIABLE_CODE, exception.getMessage());
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

    @ExceptionHandler(AccountingRuleNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingRuleNotFound(AccountingRuleNotFoundException exception) {
        return errorResponse(HttpStatus.NOT_FOUND, ACCOUNTING_RULE_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(InvalidAccountingRuleException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidAccountingRule(InvalidAccountingRuleException exception) {
        return errorResponse(HttpStatus.BAD_REQUEST, ACCOUNTING_RULE_VALIDATION_ERROR_CODE, exception.getMessage());
    }

    @ExceptionHandler(AccountingEntryPrerequisitesException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingEntryPrerequisites(
            AccountingEntryPrerequisitesException exception
    ) {
        AccountingEntryPrerequisitesResponse response = new AccountingEntryPrerequisitesResponse(
                ACCOUNTING_ENTRY_PREREQUISITES_MISSING_CODE,
                exception.getMessage(),
                exception.getMissingPrerequisites()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(AccountingEntryLineNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingEntryLineNotFound(
            AccountingEntryLineNotFoundException exception
    ) {
        return errorResponse(HttpStatus.NOT_FOUND, ACCOUNTING_ENTRY_LINE_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(AccountingEntryNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingEntryNotFound(
            AccountingEntryNotFoundException exception
    ) {
        return errorResponse(HttpStatus.NOT_FOUND, ACCOUNTING_ENTRY_NOT_FOUND_CODE, exception.getMessage());
    }

    @ExceptionHandler(AccountingEntryReversalNotAllowedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingEntryReversalNotAllowed(
            AccountingEntryReversalNotAllowedException exception
    ) {
        return errorResponse(
                HttpStatus.CONFLICT,
                ACCOUNTING_ENTRY_REVERSAL_NOT_ALLOWED_CODE,
                exception.getMessage()
        );
    }

    @ExceptionHandler(InvalidAccountingEntryLineCorrectionException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidAccountingEntryLineCorrection(
            InvalidAccountingEntryLineCorrectionException exception
    ) {
        return errorResponse(
                HttpStatus.BAD_REQUEST,
                ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR_CODE,
                exception.getMessage()
        );
    }

    @ExceptionHandler(AccountingEntryNotModifiableException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingEntryNotModifiable(
            AccountingEntryNotModifiableException exception
    ) {
        return errorResponse(HttpStatus.CONFLICT, ACCOUNTING_ENTRY_NOT_MODIFIABLE_CODE, exception.getMessage());
    }

    @ExceptionHandler(UnbalancedAccountingEntryException.class)
    public ResponseEntity<UnbalancedAccountingEntryResponse> handleUnbalancedAccountingEntry(
            UnbalancedAccountingEntryException exception
    ) {
        UnbalancedAccountingEntryResponse response = new UnbalancedAccountingEntryResponse(
                ACCOUNTING_ENTRY_UNBALANCED_CODE,
                exception.getMessage(),
                exception.getAccountingEntryId(),
                exception.getTotalDebit(),
                exception.getTotalCredit(),
                exception.getBalanceDifference()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(AccountingExportValidationException.class)
    public ResponseEntity<AccountingExportValidationResponse> handleAccountingExportValidation(
            AccountingExportValidationException exception
    ) {
        AccountingExportValidationResponse response = new AccountingExportValidationResponse(
                ACCOUNTING_EXPORT_VALIDATION_FAILED_CODE,
                exception.getMessage(),
                exception.getInvoiceErrors()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(AccountingExportFileNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountingExportFileNotFound(
            AccountingExportFileNotFoundException exception
    ) {
        return errorResponse(HttpStatus.NOT_FOUND, ACCOUNTING_EXPORT_FILE_NOT_FOUND_CODE, exception.getMessage());
    }

    private ResponseEntity<ApiErrorResponse> errorResponse(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiErrorResponse(code, message));
    }
}
