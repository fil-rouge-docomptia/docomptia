package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.InvoiceStatusTransitionException;
import org.facturation.backend.exception.ArchivedInvoiceNotModifiableException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.model.InvoiceValidationDecision;
import org.facturation.backend.model.InvoiceValidationDecisionType;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceValidationDecisionRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceValidationWorkflowTransitionsIntegrationTest {

    private static final long ORGANIZATION_ID = 1L;
    private static final String CORRECTION_REASON = "The total amount must be corrected";
    private static final String REJECTION_REASON = "The supplier reference is invalid";

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusHistoryRepository statusHistoryRepository;
    private final InvoiceValidationDecisionRepository validationDecisionRepository;
    private final InvoiceStatusWorkflowService statusWorkflowService;

    @Autowired
    InvoiceValidationWorkflowTransitionsIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceStatusHistoryRepository statusHistoryRepository,
            InvoiceValidationDecisionRepository validationDecisionRepository,
            InvoiceStatusWorkflowService statusWorkflowService
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.statusHistoryRepository = statusHistoryRepository;
        this.validationDecisionRepository = validationDecisionRepository;
        this.statusWorkflowService = statusWorkflowService;
    }

    @Test
    void coversEveryAllowedValidationTransitionWithStatusesAndHistories() {
        Long invoiceId = uploadCompleteInvoice();

        invoiceService.submitForValidation(invoiceId).orElseThrow();
        invoiceService.requestInvoiceCorrection(invoiceId, CORRECTION_REASON).orElseThrow();
        correctTotal(invoiceId, "121.00");
        invoiceService.submitForValidation(invoiceId).orElseThrow();
        invoiceService.rejectInvoice(invoiceId, REJECTION_REASON).orElseThrow();
        correctInvoiceNumber(invoiceId, "INV-RETURN-001");
        invoiceService.submitForValidation(invoiceId).orElseThrow();
        invoiceService.validateInvoice(invoiceId).orElseThrow();

        Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
        List<InvoiceStatusHistory> validationHistory = lastValidationHistoryEntries(invoiceId);
        List<InvoiceValidationDecision> decisions = validationDecisions(invoiceId);

        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), invoice.getInvoiceStatus().getCode());
        assertEquals(
                List.of(
                        InvoiceStatusCode.A_VERIFIER,
                        InvoiceStatusCode.EXTRAITE,
                        InvoiceStatusCode.A_VERIFIER,
                        InvoiceStatusCode.REJETEE,
                        InvoiceStatusCode.EXTRAITE,
                        InvoiceStatusCode.A_VERIFIER,
                        InvoiceStatusCode.VALIDEE
                ),
                validationHistory.stream()
                        .map(history -> InvoiceStatusCode.fromCode(history.getInvoiceStatus().getCode()))
                        .toList()
        );
        assertEquals(
                List.of(
                        "Invoice submitted for validation",
                        CORRECTION_REASON,
                        "Invoice submitted for validation",
                        REJECTION_REASON,
                        "Rejected invoice corrected and ready for submission",
                        "Invoice submitted for validation",
                        "Invoice validated"
                ),
                validationHistory.stream().map(InvoiceStatusHistory::getComment).toList()
        );
        validationHistory.forEach(history -> {
            assertEquals(1L, history.getChangedByUser().getUserId());
            assertNotNull(history.getChangedAt());
        });

        assertEquals(
                List.of(
                        InvoiceValidationDecisionType.CORRECTION_REQUEST,
                        InvoiceValidationDecisionType.REJECTION,
                        InvoiceValidationDecisionType.VALIDATION
                ),
                decisions.stream().map(InvoiceValidationDecision::getDecisionType).toList()
        );
        assertEquals(Arrays.asList(CORRECTION_REASON, REJECTION_REASON, null),
                decisions.stream().map(InvoiceValidationDecision::getReason).toList());
        decisions.forEach(decision -> {
            assertEquals(1L, decision.getDecidedByUser().getUserId());
            assertNotNull(decision.getDecidedAt());
        });
    }

    @ParameterizedTest(name = "{0} is forbidden from {1}")
    @MethodSource("forbiddenValidationTransitions")
    void refusesEveryForbiddenValidationTransitionWithoutChangingStatusOrHistories(
            ValidationAction action,
            InvoiceStatusCode sourceStatus
    ) {
        Long invoiceId = uploadCompleteInvoice();
        Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
        invoice.setInvoiceStatus(statusWorkflowService.findByCode(sourceStatus));
        invoiceRepository.saveAndFlush(invoice);
        int historyCountBefore = statusHistory(invoiceId).size();
        int decisionCountBefore = validationDecisions(invoiceId).size();

        InvoiceStatusTransitionException exception = assertThrows(
                InvoiceStatusTransitionException.class,
                () -> action.execute(invoiceService, invoiceId)
        );

        Invoice persistedInvoice = invoiceRepository.findById(invoiceId).orElseThrow();
        assertEquals(
                "Invoice " + invoiceId + " cannot " + action.description + " from status " + sourceStatus.getCode(),
                exception.getMessage()
        );
        assertEquals(sourceStatus.getCode(), persistedInvoice.getInvoiceStatus().getCode());
        assertEquals(historyCountBefore, statusHistory(invoiceId).size());
        assertEquals(decisionCountBefore, validationDecisions(invoiceId).size());
    }

    private static Stream<Arguments> forbiddenValidationTransitions() {
        return Arrays.stream(ValidationAction.values())
                .flatMap(action -> Arrays.stream(InvoiceStatusCode.values())
                        .filter(status -> status != action.allowedSourceStatus)
                        .filter(status -> status != InvoiceStatusCode.ARCHIVEE)
                        .map(status -> Arguments.of(action, status)));
    }

    @ParameterizedTest(name = "{0} is forbidden for an archived invoice")
    @MethodSource("validationActions")
    void returnsArchivedReadOnlyErrorForEveryValidationAction(ValidationAction action) {
        Long invoiceId = uploadCompleteInvoice();
        Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
        invoice.setInvoiceStatus(statusWorkflowService.findByCode(InvoiceStatusCode.ARCHIVEE));
        invoiceRepository.saveAndFlush(invoice);
        int historyCountBefore = statusHistory(invoiceId).size();
        int decisionCountBefore = validationDecisions(invoiceId).size();

        ArchivedInvoiceNotModifiableException exception = assertThrows(
                ArchivedInvoiceNotModifiableException.class,
                () -> action.execute(invoiceService, invoiceId)
        );

        assertEquals("Archived invoice " + invoiceId + " is read-only and cannot be modified", exception.getMessage());
        assertEquals(historyCountBefore, statusHistory(invoiceId).size());
        assertEquals(decisionCountBefore, validationDecisions(invoiceId).size());
    }

    private static Stream<ValidationAction> validationActions() {
        return Arrays.stream(ValidationAction.values());
    }

    private Long uploadCompleteInvoice() {
        InvoiceUploadResponse uploadResponse = invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
        InvoiceCorrectionRequest correction = new InvoiceCorrectionRequest();
        correction.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(uploadResponse.getInvoiceId(), correction).orElseThrow();
        return uploadResponse.getInvoiceId();
    }

    private void correctTotal(Long invoiceId, String totalTtc) {
        InvoiceCorrectionRequest correction = new InvoiceCorrectionRequest();
        correction.setTotalTtc(totalTtc);
        invoiceService.correctInvoice(invoiceId, correction).orElseThrow();
    }

    private void correctInvoiceNumber(Long invoiceId, String invoiceNumber) {
        InvoiceCorrectionRequest correction = new InvoiceCorrectionRequest();
        correction.setInvoiceNumber(invoiceNumber);
        invoiceService.correctInvoice(invoiceId, correction).orElseThrow();
    }

    private List<InvoiceStatusHistory> lastValidationHistoryEntries(Long invoiceId) {
        List<InvoiceStatusHistory> history = statusHistory(invoiceId);
        return history.subList(history.size() - 7, history.size());
    }

    private List<InvoiceStatusHistory> statusHistory(Long invoiceId) {
        return statusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        invoiceId,
                        ORGANIZATION_ID
                );
    }

    private List<InvoiceValidationDecision> validationDecisions(Long invoiceId) {
        return validationDecisionRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByDecidedAtAscInvoiceValidationDecisionIdAsc(
                        invoiceId,
                        ORGANIZATION_ID
                );
    }

    private enum ValidationAction {
        SUBMIT(InvoiceStatusCode.EXTRAITE, "be submitted for validation") {
            @Override
            void execute(InvoiceService invoiceService, Long invoiceId) {
                invoiceService.submitForValidation(invoiceId);
            }
        },
        VALIDATE(InvoiceStatusCode.A_VERIFIER, "be validated") {
            @Override
            void execute(InvoiceService invoiceService, Long invoiceId) {
                invoiceService.validateInvoice(invoiceId);
            }
        },
        REJECT(InvoiceStatusCode.A_VERIFIER, "be rejected") {
            @Override
            void execute(InvoiceService invoiceService, Long invoiceId) {
                invoiceService.rejectInvoice(invoiceId, REJECTION_REASON);
            }
        },
        REQUEST_CORRECTION(InvoiceStatusCode.A_VERIFIER, "receive a correction request") {
            @Override
            void execute(InvoiceService invoiceService, Long invoiceId) {
                invoiceService.requestInvoiceCorrection(invoiceId, CORRECTION_REASON);
            }
        };

        private final InvoiceStatusCode allowedSourceStatus;
        private final String description;

        ValidationAction(InvoiceStatusCode allowedSourceStatus, String description) {
            this.allowedSourceStatus = allowedSourceStatus;
            this.description = description;
        }

        abstract void execute(InvoiceService invoiceService, Long invoiceId);
    }
}
