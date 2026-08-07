package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.exception.InvoiceMissingRequiredFieldsException;
import org.facturation.backend.exception.InvoiceStatusTransitionException;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.model.OcrExtractionField;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.OcrExtractionFieldRepository;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
class InvoiceLifecycleStatusIntegrationTest {

    private final InvoiceService invoiceService;
    private final AuditLogRepository auditLogRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;
    private final OcrExtractionRepository ocrExtractionRepository;
    private final OcrExtractionFieldRepository ocrExtractionFieldRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final UserRepository userRepository;
    private final ApiExceptionHandler apiExceptionHandler;

    @Autowired
    InvoiceLifecycleStatusIntegrationTest(
            InvoiceService invoiceService,
            AuditLogRepository auditLogRepository,
            InvoiceRepository invoiceRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository,
            OcrExtractionRepository ocrExtractionRepository,
            OcrExtractionFieldRepository ocrExtractionFieldRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            UserRepository userRepository,
            ApiExceptionHandler apiExceptionHandler
    ) {
        this.invoiceService = invoiceService;
        this.auditLogRepository = auditLogRepository;
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
        this.ocrExtractionRepository = ocrExtractionRepository;
        this.ocrExtractionFieldRepository = ocrExtractionFieldRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.userRepository = userRepository;
        this.apiExceptionHandler = apiExceptionHandler;
    }

    @Test
    void movesRejectedInvoiceBackToReviewAfterCorrection() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        InvoiceStatusResponse rejectResponse = invoiceService.rejectInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        InvoiceCorrectionRequest request = new InvoiceCorrectionRequest();
        request.setInvoiceNumber("INV-CORR-001");

        InvoiceDetailsResponse correctedResponse = invoiceService
                .correctInvoice(uploadResponse.getInvoiceId(), request)
                .orElseThrow();
        InvoiceStatusHistory latestHistory = findLatestHistory(uploadResponse.getInvoiceId());

        assertEquals(InvoiceStatusCode.REJETEE.getCode(), rejectResponse.getStatus());
        assertEquals(InvoiceStatusCode.A_VERIFIER.getCode(), correctedResponse.getStatus());
        assertEquals("INV-CORR-001", correctedResponse.getInvoiceNumber());
        assertEquals(InvoiceStatusCode.A_VERIFIER.getCode(), latestHistory.getInvoiceStatus().getCode());
        assertEquals(uploadResponse.getInvoiceId(), latestHistory.getInvoice().getInvoiceId());
        assertEquals(1L, latestHistory.getChangedByUser().getUserId());
        assertEquals(1L, latestHistory.getInvoice().getOrganization().getOrganizationId());
    }

    @Test
    void rejectsCorrectionsOnceInvoiceIsValidated() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        Invoice persistedBeforeCorrection = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        String initialInvoiceNumber = persistedBeforeCorrection.getInvoiceNumber();
        InvoiceCorrectionRequest request = new InvoiceCorrectionRequest();
        request.setInvoiceNumber("INV-LOCKED-001");

        InvoiceStatusTransitionException exception = assertThrows(
                InvoiceStatusTransitionException.class,
                () -> invoiceService.correctInvoice(uploadResponse.getInvoiceId(), request)
        );
        ResponseEntity<Map<String, String>> errorResponse =
                apiExceptionHandler.handleInvoiceStatusTransition(exception);
        Invoice persistedAfterCorrection = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();

        assertEquals(
                "Invoice " + uploadResponse.getInvoiceId() + " cannot be corrected from status VALIDEE",
                exception.getMessage()
        );
        assertEquals(HttpStatus.CONFLICT, errorResponse.getStatusCode());
        assertEquals(exception.getMessage(), errorResponse.getBody().get("message"));
        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), persistedAfterCorrection.getInvoiceStatus().getCode());
        assertEquals(initialInvoiceNumber, persistedAfterCorrection.getInvoiceNumber());
    }

    @Test
    void returnsExplicitErrorWhenInvoiceIsAlreadyValidated() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();

        InvoiceStatusTransitionException exception = assertThrows(
                InvoiceStatusTransitionException.class,
                () -> invoiceService.validateInvoice(uploadResponse.getInvoiceId())
        );
        ResponseEntity<Map<String, String>> errorResponse =
                apiExceptionHandler.handleInvoiceStatusTransition(exception);
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();

        assertEquals(
                "Invoice " + uploadResponse.getInvoiceId() + " cannot be validated from status VALIDEE",
                exception.getMessage()
        );
        assertEquals(HttpStatus.CONFLICT, errorResponse.getStatusCode());
        assertEquals(exception.getMessage(), errorResponse.getBody().get("message"));
        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), persistedInvoice.getInvoiceStatus().getCode());
    }

    @Test
    void returnsExplicitErrorWhenInvoiceIsAlreadyRejected() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        invoiceService.rejectInvoice(uploadResponse.getInvoiceId()).orElseThrow();

        InvoiceStatusTransitionException exception = assertThrows(
                InvoiceStatusTransitionException.class,
                () -> invoiceService.rejectInvoice(uploadResponse.getInvoiceId())
        );
        ResponseEntity<Map<String, String>> errorResponse =
                apiExceptionHandler.handleInvoiceStatusTransition(exception);
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();

        assertEquals(
                "Invoice " + uploadResponse.getInvoiceId() + " cannot be rejected from status REJETEE",
                exception.getMessage()
        );
        assertEquals(HttpStatus.CONFLICT, errorResponse.getStatusCode());
        assertEquals(exception.getMessage(), errorResponse.getBody().get("message"));
        assertEquals(InvoiceStatusCode.REJETEE.getCode(), persistedInvoice.getInvoiceStatus().getCode());
    }

    @Test
    void returnsExplicitErrorWhenReviewedInvoiceIsMissingRequiredFields() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        invoiceService.rejectInvoice(uploadResponse.getInvoiceId()).orElseThrow();

        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setCommandReference("CMD-REVIEW-001");
        InvoiceDetailsResponse reviewedResponse = invoiceService
                .correctInvoice(uploadResponse.getInvoiceId(), correctionRequest)
                .orElseThrow();

        InvoiceMissingRequiredFieldsException exception = assertThrows(
                InvoiceMissingRequiredFieldsException.class,
                () -> invoiceService.validateInvoice(uploadResponse.getInvoiceId())
        );
        ResponseEntity<Map<String, String>> errorResponse =
                apiExceptionHandler.handleInvoiceMissingRequiredFields(exception);
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();

        assertEquals(InvoiceStatusCode.A_VERIFIER.getCode(), reviewedResponse.getStatus());
        assertEquals(
                "Invoice " + uploadResponse.getInvoiceId()
                        + " cannot be validated from status A_VERIFIER because required fields are missing: invoiceDate",
                exception.getMessage()
        );
        assertEquals(HttpStatus.CONFLICT, errorResponse.getStatusCode());
        assertEquals(exception.getMessage(), errorResponse.getBody().get("message"));
        assertEquals(InvoiceStatusCode.A_VERIFIER.getCode(), persistedInvoice.getInvoiceStatus().getCode());
    }

    @Test
    void validatesReviewedInvoiceWhenRequiredFieldsArePresent() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        invoiceService.rejectInvoice(uploadResponse.getInvoiceId()).orElseThrow();

        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setInvoiceDate("2026-08-07");
        InvoiceDetailsResponse reviewedResponse = invoiceService
                .correctInvoice(uploadResponse.getInvoiceId(), correctionRequest)
                .orElseThrow();

        InvoiceStatusResponse validationResponse = invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        InvoiceStatusHistory latestHistory = findLatestHistory(uploadResponse.getInvoiceId());

        assertEquals(InvoiceStatusCode.A_VERIFIER.getCode(), reviewedResponse.getStatus());
        assertEquals("2026-08-07", reviewedResponse.getInvoiceDate());
        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), validationResponse.getStatus());
        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), persistedInvoice.getInvoiceStatus().getCode());
        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), latestHistory.getInvoiceStatus().getCode());
    }

    @Test
    void persistsCorrectionTraceOnInvoiceAuditAndLatestOcrExtraction() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        InvoiceCorrectionRequest firstCorrectionRequest = new InvoiceCorrectionRequest();
        firstCorrectionRequest.setInvoiceDate("2026-08-07");
        firstCorrectionRequest.setTotalTtc("125.50");

        InvoiceDetailsResponse firstCorrectionResponse = invoiceService
                .correctInvoice(uploadResponse.getInvoiceId(), firstCorrectionRequest)
                .orElseThrow();

        InvoiceCorrectionRequest secondCorrectionRequest = new InvoiceCorrectionRequest();
        secondCorrectionRequest.setTotalTtc("130.00");
        InvoiceDetailsResponse correctedResponse = invoiceService
                .correctInvoice(uploadResponse.getInvoiceId(), secondCorrectionRequest)
                .orElseThrow();
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        OcrExtraction latestExtraction = ocrExtractionRepository
                .findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(uploadResponse.getInvoiceId())
                .orElseThrow();
        List<OcrExtractionField> extractionFields = ocrExtractionFieldRepository
                .findByOcrExtractionOcrExtractionId(latestExtraction.getOcrExtractionId());
        List<AuditLog> correctionLogs = auditLogRepository.findAll().stream()
                .filter(auditLog -> "Invoice".equals(auditLog.getEntityName()))
                .filter(auditLog -> uploadResponse.getInvoiceId().equals(auditLog.getEntityId()))
                .filter(auditLog -> "FIELD_CORRECTION".equals(auditLog.getAction()))
                .toList();

        OcrFieldResponse correctedInvoiceDateResponseField = findResponseField(correctedResponse, "invoiceDate");
        OcrFieldResponse correctedTotalTtcResponseField = findResponseField(correctedResponse, "totalTtc");
        OcrFieldResponse unchangedSupplierResponseField = findResponseField(correctedResponse, "supplierName");
        OcrExtractionField invoiceDateField = findExtractionField(extractionFields, "invoiceDate");
        OcrExtractionField totalTtcField = findExtractionField(extractionFields, "totalTtc");

        assertEquals("2026-08-07", firstCorrectionResponse.getInvoiceDate());
        assertEquals("125.50", firstCorrectionResponse.getTotalTtc());
        assertEquals("2026-08-07", correctedResponse.getInvoiceDate());
        assertEquals("130.00", correctedResponse.getTotalTtc());
        assertEquals("2026-08-07", persistedInvoice.getInvoiceDate().toString());
        assertEquals("130.00", persistedInvoice.getTotalTtc().toString());
        assertTrue(correctedInvoiceDateResponseField.isCorrected());
        assertTrue(correctedTotalTtcResponseField.isCorrected());
        assertFalse(unchangedSupplierResponseField.isCorrected());

        assertNull(invoiceDateField.getRawValue());
        assertEquals("2026-08-07", invoiceDateField.getNormalizedValue());
        assertTrue(invoiceDateField.isCorrected());
        assertEquals(1L, invoiceDateField.getCorrectedByUser().getUserId());

        assertEquals("120.00", totalTtcField.getRawValue());
        assertEquals("130.00", totalTtcField.getNormalizedValue());
        assertTrue(totalTtcField.isCorrected());
        assertEquals(1L, totalTtcField.getCorrectedByUser().getUserId());

        assertEquals(3, correctionLogs.size());
        assertTrue(correctionLogs.stream().allMatch(auditLog -> auditLog.getUser().getUserId().equals(1L)));
        assertTrue(correctionLogs.stream().allMatch(auditLog -> auditLog.getOrganization().getOrganizationId().equals(1L)));
        assertTrue(correctionLogs.stream().anyMatch(auditLog ->
                "invoiceDate=null".equals(auditLog.getOldValue())
                        && "invoiceDate=2026-08-07".equals(auditLog.getNewValue())
        ));
        assertTrue(correctionLogs.stream().anyMatch(auditLog ->
                "totalTtc=120.00".equals(auditLog.getOldValue())
                        && "totalTtc=125.50".equals(auditLog.getNewValue())
        ));
        assertTrue(correctionLogs.stream().anyMatch(auditLog ->
                "totalTtc=125.50".equals(auditLog.getOldValue())
                        && "totalTtc=130.00".equals(auditLog.getNewValue())
        ));
    }

    @Test
    void rejectsNoOpCorrectionWithoutChangingStatusOrAuditTrace() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();
        invoiceService.rejectInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        long correctionLogCountBefore = countCorrectionLogs(uploadResponse.getInvoiceId());
        InvoiceStatusHistory latestHistoryBefore = findLatestHistory(uploadResponse.getInvoiceId());

        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setTotalTtc("120.00");

        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correctionRequest)
        );
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        InvoiceStatusHistory latestHistoryAfter = findLatestHistory(uploadResponse.getInvoiceId());

        assertEquals("At least one changed field is required", exception.getMessage());
        assertEquals(InvoiceStatusCode.REJETEE.getCode(), persistedInvoice.getInvoiceStatus().getCode());
        assertEquals("120.00", persistedInvoice.getTotalTtc().toString());
        assertEquals(correctionLogCountBefore, countCorrectionLogs(uploadResponse.getInvoiceId()));
        assertEquals(
                latestHistoryBefore.getInvoiceStatusHistoryId(),
                latestHistoryAfter.getInvoiceStatusHistoryId()
        );
    }

    @Test
    void marksValidatedInvoiceAsExportableWhenAccountingEntryIsGenerated() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        InvoiceStatusResponse validationResponse = invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        InvoiceAccountingEntryResponse accountingEntryResponse = invoiceService
                .generateAccountingEntry(uploadResponse.getInvoiceId())
                .orElseThrow();
        Invoice persistedInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();

        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), validationResponse.getStatus());
        assertEquals(InvoiceStatusCode.EXPORTABLE.getCode(), accountingEntryResponse.getStatus());
        assertEquals(InvoiceStatusCode.EXPORTABLE.getCode(), persistedInvoice.getInvoiceStatus().getCode());
        assertNotNull(accountingEntryResponse.getAccountingEntry());
        assertNotNull(accountingEntryResponse.getAccountingEntry().getLines());
    }

    @Test
    void returnsExplicitErrorForInvalidAccountingStatusAndSupportsExportAndArchiveStatuses() {
        InvoiceUploadResponse uploadResponse = uploadInvoice();

        InvoiceStatusTransitionException exception = assertThrows(
                InvoiceStatusTransitionException.class,
                () -> invoiceService.generateAccountingEntry(uploadResponse.getInvoiceId())
        );
        ResponseEntity<Map<String, String>> errorResponse =
                apiExceptionHandler.handleInvoiceStatusTransition(exception);

        assertEquals(
                "Invoice " + uploadResponse.getInvoiceId() + " cannot transition from EXTRAITE to EXPORTABLE",
                exception.getMessage()
        );
        assertEquals(HttpStatus.CONFLICT, errorResponse.getStatusCode());
        assertEquals(exception.getMessage(), errorResponse.getBody().get("message"));

        invoiceService.validateInvoice(uploadResponse.getInvoiceId()).orElseThrow();
        invoiceService.generateAccountingEntry(uploadResponse.getInvoiceId()).orElseThrow();
        Invoice exportableInvoice = invoiceRepository.findById(uploadResponse.getInvoiceId()).orElseThrow();
        User user = userRepository.findById(1L).orElseThrow();

        invoiceStatusWorkflowService.transitionTo(
                exportableInvoice,
                InvoiceStatusCode.EXPORTEE,
                user,
                "Accounting export completed"
        );
        invoiceStatusWorkflowService.transitionTo(
                exportableInvoice,
                InvoiceStatusCode.ARCHIVEE,
                user,
                "Invoice archived"
        );

        InvoiceStatusHistory latestHistory = findLatestHistory(uploadResponse.getInvoiceId());

        assertEquals(InvoiceStatusCode.ARCHIVEE.getCode(), exportableInvoice.getInvoiceStatus().getCode());
        assertEquals(InvoiceStatusCode.ARCHIVEE.getCode(), latestHistory.getInvoiceStatus().getCode());
        assertEquals(uploadResponse.getInvoiceId(), latestHistory.getInvoice().getInvoiceId());
        assertEquals(1L, latestHistory.getChangedByUser().getUserId());
        assertEquals(1L, latestHistory.getInvoice().getOrganization().getOrganizationId());
    }

    private InvoiceUploadResponse uploadInvoice() {
        return invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
    }

    private InvoiceStatusHistory findLatestHistory(Long invoiceId) {
        return invoiceStatusHistoryRepository.findAll().stream()
                .filter(history -> invoiceId.equals(history.getInvoice().getInvoiceId()))
                .max(Comparator.comparing(InvoiceStatusHistory::getInvoiceStatusHistoryId))
                .orElseThrow();
    }

    private OcrExtractionField findExtractionField(List<OcrExtractionField> extractionFields, String fieldName) {
        return extractionFields.stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .findFirst()
                .orElseThrow();
    }

    private OcrFieldResponse findResponseField(InvoiceDetailsResponse response, String fieldName) {
        return response.getOcrAnalysis().getFields().stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .findFirst()
                .orElseThrow();
    }

    private long countCorrectionLogs(Long invoiceId) {
        return auditLogRepository.findAll().stream()
                .filter(auditLog -> "Invoice".equals(auditLog.getEntityName()))
                .filter(auditLog -> invoiceId.equals(auditLog.getEntityId()))
                .filter(auditLog -> "FIELD_CORRECTION".equals(auditLog.getAction()))
                .count();
    }
}
