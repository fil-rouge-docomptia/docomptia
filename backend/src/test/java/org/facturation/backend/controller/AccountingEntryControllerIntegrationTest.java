package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.InvoiceService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class AccountingEntryControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AuditLogRepository auditLogRepository;
    private final ChartOfAccountRepository chartOfAccountRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final UserRepository userRepository;

    @Autowired
    AccountingEntryControllerIntegrationTest(
            AccountingEntryController accountingEntryController,
            ApiExceptionHandler apiExceptionHandler,
            AccountingEntryLineRepository accountingEntryLineRepository,
            AuditLogRepository auditLogRepository,
            ChartOfAccountRepository chartOfAccountRepository,
            InvoiceRepository invoiceRepository,
            InvoiceService invoiceService,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            UserRepository userRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(accountingEntryController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.auditLogRepository = auditLogRepository;
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.invoiceRepository = invoiceRepository;
        this.invoiceService = invoiceService;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.userRepository = userRepository;
    }

    @Test
    void correctsNonExportedLineAndPersistsOneAuditLogPerChangedField() throws Exception {
        GeneratedLine generatedLine = generateAccountingEntry();

        mockMvc.perform(patch(
                        "/api/v1/accounting-entries/{entryId}/lines/{lineId}",
                        generatedLine.entryId(),
                        generatedLine.line().getAccountingEntryLineId()
                )
                        .contentType("application/json")
                        .content("""
                                {
                                  "accountId": 2,
                                  "lineLabel": "Achat corrige",
                                  "debitAmount": 99.99,
                                  "creditAmount": 0
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountingEntryId").value(generatedLine.entryId()))
                .andExpect(jsonPath("$.totalDebit").value("119.99"))
                .andExpect(jsonPath("$.totalCredit").value("120.00"))
                .andExpect(jsonPath("$.balanceDifference").value("0.01"))
                .andExpect(jsonPath("$.balanced").value(false))
                .andExpect(jsonPath("$.lines[0].accountingEntryLineId")
                        .value(generatedLine.line().getAccountingEntryLineId()))
                .andExpect(jsonPath("$.lines[0].accountNumber").value("607000"))
                .andExpect(jsonPath("$.lines[0].lineLabel").value("Achat corrige"))
                .andExpect(jsonPath("$.lines[0].debitAmount").value("99.99"));

        AccountingEntryLine persistedLine = accountingEntryLineRepository
                .findById(generatedLine.line().getAccountingEntryLineId())
                .orElseThrow();
        List<AuditLog> correctionLogs = findLineCorrectionLogs(persistedLine.getAccountingEntryLineId());

        assertEquals(2L, persistedLine.getAccount().getAccountId());
        assertEquals("Achat corrige", persistedLine.getLineLabel());
        assertEquals("99.99", persistedLine.getDebitAmount().toPlainString());
        assertEquals(
                InvoiceStatusCode.VALIDEE.getCode(),
                invoiceRepository.findById(generatedLine.invoiceId()).orElseThrow().getInvoiceStatus().getCode()
        );
        assertEquals(3, correctionLogs.size());
        assertTrue(correctionLogs.stream().allMatch(log -> log.getUser().getUserId().equals(1L)));
        assertTrue(correctionLogs.stream().allMatch(log -> log.getOrganization().getOrganizationId().equals(1L)));
        assertTrue(correctionLogs.stream().anyMatch(log -> "accountId=4".equals(log.getOldValue())
                && "accountId=2".equals(log.getNewValue())));
        assertTrue(correctionLogs.stream().anyMatch(log -> "debitAmount=100.00".equals(log.getOldValue())
                && "debitAmount=99.99".equals(log.getNewValue())));

        mockMvc.perform(patch(
                        "/api/v1/accounting-entries/{entryId}/lines/{lineId}",
                        generatedLine.entryId(),
                        generatedLine.line().getAccountingEntryLineId()
                )
                        .contentType("application/json")
                        .content("{\"debitAmount\": 100.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balanceDifference").value("0.00"))
                .andExpect(jsonPath("$.balanced").value(true));

        assertEquals(
                InvoiceStatusCode.EXPORTABLE.getCode(),
                invoiceRepository.findById(generatedLine.invoiceId()).orElseThrow().getInvoiceStatus().getCode()
        );
    }

    @Test
    void rejectsCorrectionAfterExportWithoutChangingLineOrHistory() throws Exception {
        GeneratedLine generatedLine = generateAccountingEntry();
        Invoice invoice = invoiceRepository.findById(generatedLine.invoiceId()).orElseThrow();
        User user = userRepository.findById(1L).orElseThrow();
        invoiceStatusWorkflowService.transitionTo(
                invoice,
                InvoiceStatusCode.EXPORTEE,
                user,
                "Accounting export completed"
        );

        mockMvc.perform(patch(
                        "/api/v1/accounting-entries/{entryId}/lines/{lineId}",
                        generatedLine.entryId(),
                        generatedLine.line().getAccountingEntryLineId()
                )
                        .contentType("application/json")
                        .content("{\"lineLabel\": \"Modification interdite\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_NOT_MODIFIABLE"));

        AccountingEntryLine persistedLine = accountingEntryLineRepository
                .findById(generatedLine.line().getAccountingEntryLineId())
                .orElseThrow();
        assertEquals(generatedLine.line().getLineLabel(), persistedLine.getLineLabel());
        assertTrue(findLineCorrectionLogs(persistedLine.getAccountingEntryLineId()).isEmpty());
    }

    @Test
    void rejectsInactiveAccountFromCorrection() throws Exception {
        GeneratedLine generatedLine = generateAccountingEntry();
        var inactiveAccount = chartOfAccountRepository.findById(2L).orElseThrow();
        inactiveAccount.setActive(false);
        chartOfAccountRepository.saveAndFlush(inactiveAccount);

        mockMvc.perform(patch(
                        "/api/v1/accounting-entries/{entryId}/lines/{lineId}",
                        generatedLine.entryId(),
                        generatedLine.line().getAccountingEntryLineId()
                )
                        .contentType("application/json")
                        .content("{\"accountId\": 2}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ACCOUNTING_ENTRY_LINE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value(
                        "accountId must reference an active account of the organization"
                ));
    }

    private GeneratedLine generateAccountingEntry() {
        InvoiceUploadResponse uploadedInvoice = invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
        InvoiceCorrectionRequest correctionRequest = new InvoiceCorrectionRequest();
        correctionRequest.setInvoiceDate("2026-08-07");
        invoiceService.correctInvoice(uploadedInvoice.getInvoiceId(), correctionRequest).orElseThrow();
        invoiceService.submitForValidation(uploadedInvoice.getInvoiceId()).orElseThrow();
        invoiceService.validateInvoice(uploadedInvoice.getInvoiceId()).orElseThrow();
        InvoiceAccountingEntryResponse response = invoiceService
                .generateAccountingEntry(uploadedInvoice.getInvoiceId())
                .orElseThrow();
        Long entryId = response.getAccountingEntry().getAccountingEntryId();
        AccountingEntryLine line = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .getFirst();
        return new GeneratedLine(uploadedInvoice.getInvoiceId(), entryId, line);
    }

    private List<AuditLog> findLineCorrectionLogs(Long lineId) {
        return auditLogRepository.findAll().stream()
                .filter(log -> AccountingEntryLine.class.getSimpleName().equals(log.getEntityName()))
                .filter(log -> lineId.equals(log.getEntityId()))
                .filter(log -> "LINE_CORRECTION".equals(log.getAction()))
                .toList();
    }

    private record GeneratedLine(Long invoiceId, Long entryId, AccountingEntryLine line) {
    }
}
