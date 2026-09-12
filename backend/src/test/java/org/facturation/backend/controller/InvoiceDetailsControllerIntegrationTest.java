package org.facturation.backend.controller;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.OcrExtractionFieldRepository;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceDetailsControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceService invoiceService;
    private final AccountingEntryRepository accountingEntryRepository;
    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final OcrExtractionRepository ocrExtractionRepository;
    private final OcrExtractionFieldRepository ocrExtractionFieldRepository;

    @Autowired
    InvoiceDetailsControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceService invoiceService,
            AccountingEntryRepository accountingEntryRepository,
            AccountingEntryLineRepository accountingEntryLineRepository,
            OcrExtractionRepository ocrExtractionRepository,
            OcrExtractionFieldRepository ocrExtractionFieldRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceService = invoiceService;
        this.accountingEntryRepository = accountingEntryRepository;
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.ocrExtractionRepository = ocrExtractionRepository;
        this.ocrExtractionFieldRepository = ocrExtractionFieldRepository;
    }

    @Test
    void returnsOcrExtractionAndNormalizedFieldsWithNullAccountingEntry() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice("invoice-with-ocr.png");

        mockMvc.perform(get("/api/v1/invoices/{id}", uploadResponse.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.origin").value("MANUAL_UPLOAD"))
                .andExpect(jsonPath("$.ocrAnalysis.status").value("SUCCESS"))
                .andExpect(jsonPath("$.ocrAnalysis.engineName").value("mock-ocr"))
                .andExpect(jsonPath("$.ocrAnalysis.rawText").value("Mock OCR result for file invoice-with-ocr.png"))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='supplierName')].rawValue")
                        .value("Orange"))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='supplierName')].normalizedValue")
                        .value("Orange SA"))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='siret')].rawValue")
                        .value("380 129 866 00014"))
                .andExpect(jsonPath("$.ocrAnalysis.fields[?(@.fieldName=='siret')].normalizedValue")
                        .value("38012986600014"))
                .andExpect(jsonPath("$.accountingEntry").value((Object) null))
                .andExpect(jsonPath("$.accountingEntries").isEmpty());
    }

    @Test
    void returnsNullExtractionWithoutErrorWhenNoExtractionExists() throws Exception {
        InvoiceUploadResponse uploadResponse = uploadInvoice("invoice-without-ocr.png");
        OcrExtraction extraction = ocrExtractionRepository
                .findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(uploadResponse.getInvoiceId())
                .orElseThrow();
        ocrExtractionFieldRepository.deleteAll(
                ocrExtractionFieldRepository.findByOcrExtractionOcrExtractionId(extraction.getOcrExtractionId())
        );
        ocrExtractionRepository.delete(extraction);
        ocrExtractionRepository.flush();

        mockMvc.perform(get("/api/v1/invoices/{id}", uploadResponse.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(uploadResponse.getInvoiceId()))
                .andExpect(jsonPath("$.ocrAnalysis").value((Object) null))
                .andExpect(jsonPath("$.accountingEntry").value((Object) null))
                .andExpect(jsonPath("$.accountingEntries").isEmpty());
    }

    @Test
    void returnsTheAccountingEntryAssociatedWithTheRequestedInvoice() throws Exception {
        InvoiceUploadResponse invoiceWithoutEntry = uploadInvoice("invoice-without-entry.png");
        InvoiceUploadResponse invoiceWithEntry = uploadInvoice("invoice-with-entry.png");
        submitForValidation(invoiceWithEntry.getInvoiceId());
        invoiceService.validateInvoice(invoiceWithEntry.getInvoiceId()).orElseThrow();
        InvoiceAccountingEntryResponse generatedEntry = invoiceService
                .generateAccountingEntry(invoiceWithEntry.getInvoiceId())
                .orElseThrow();

        mockMvc.perform(get("/api/v1/invoices/{id}", invoiceWithoutEntry.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountingEntry").value((Object) null));

        mockMvc.perform(get("/api/v1/invoices/{id}", invoiceWithEntry.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(invoiceWithEntry.getInvoiceId()))
                .andExpect(jsonPath("$.accountingEntry.accountingEntryId")
                        .value(generatedEntry.getAccountingEntry().getAccountingEntryId()))
                .andExpect(jsonPath("$.accountingEntry.lines.length()").value(3))
                .andExpect(jsonPath("$.accountingEntry.totalDebit").value("120.00"))
                .andExpect(jsonPath("$.accountingEntry.totalCredit").value("120.00"))
                .andExpect(jsonPath("$.accountingEntry.balanced").value(true));
    }

    @Test
    void returnsOriginalReversalAndCorrectiveEntryTogetherWithoutChangingLegacyEntry() throws Exception {
        InvoiceUploadResponse uploadedInvoice = uploadInvoice("invoice-with-correction-chain.png");
        submitForValidation(uploadedInvoice.getInvoiceId());
        invoiceService.validateInvoice(uploadedInvoice.getInvoiceId()).orElseThrow();
        AccountingEntry original = accountingEntryRepository.findById(invoiceService
                .generateAccountingEntry(uploadedInvoice.getInvoiceId())
                .orElseThrow()
                .getAccountingEntry()
                .getAccountingEntryId()).orElseThrow();
        AccountingEntry reversal = createRelatedEntry(original, original, "REVERSAL", "EXT-");
        AccountingEntry corrective = createRelatedEntry(original, reversal, "CORRECTIVE", "COR-");

        mockMvc.perform(get("/api/v1/invoices/{id}", uploadedInvoice.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountingEntry.accountingEntryId")
                        .value(original.getAccountingEntryId()))
                .andExpect(jsonPath("$.accountingEntries.length()").value(3))
                .andExpect(jsonPath("$.accountingEntries[0].accountingEntryId")
                        .value(original.getAccountingEntryId()))
                .andExpect(jsonPath("$.accountingEntries[0].reversedAccountingEntryId").doesNotExist())
                .andExpect(jsonPath("$.accountingEntries[1].accountingEntryId")
                        .value(reversal.getAccountingEntryId()))
                .andExpect(jsonPath("$.accountingEntries[1].reversedAccountingEntryId")
                        .value(original.getAccountingEntryId()))
                .andExpect(jsonPath("$.accountingEntries[2].accountingEntryId")
                        .value(corrective.getAccountingEntryId()))
                .andExpect(jsonPath("$.accountingEntries[2].reversedAccountingEntryId")
                        .value(reversal.getAccountingEntryId()));
    }

    private AccountingEntry createRelatedEntry(
            AccountingEntry original,
            AccountingEntry previousEntry,
            String status,
            String numberPrefix
    ) {
        LocalDateTime now = LocalDateTime.now();
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(original.getInvoice());
        entry.setReversedAccountingEntry(previousEntry);
        entry.setCreatedByUser(original.getCreatedByUser());
        entry.setEntryNumber(numberPrefix + original.getAccountingEntryId());
        entry.setEntryDate(original.getEntryDate());
        entry.setLabel(status + " - " + original.getLabel());
        entry.setStatus(status);
        entry.setCreatedAt(now);
        entry.setUpdatedAt(now);
        AccountingEntry savedEntry = accountingEntryRepository.save(entry);

        List<AccountingEntryLine> copiedLines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(original.getAccountingEntryId())
                .stream()
                .map(line -> copyLine(savedEntry, line))
                .toList();
        accountingEntryLineRepository.saveAll(copiedLines);
        return savedEntry;
    }

    private AccountingEntryLine copyLine(AccountingEntry entry, AccountingEntryLine source) {
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(entry);
        line.setAccount(source.getAccount());
        line.setLineNumber(source.getLineNumber());
        line.setLineLabel(source.getLineLabel());
        line.setDebitAmount(source.getDebitAmount());
        line.setCreditAmount(source.getCreditAmount());
        line.setCreatedAt(LocalDateTime.now());
        return line;
    }

    private InvoiceUploadResponse uploadInvoice(String fileName) {
        return invoiceService.uploadAndAnalyze(new MockMultipartFile(
                "file",
                fileName,
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        ), null);
    }

    private void submitForValidation(Long invoiceId) {
        InvoiceCorrectionRequest request = new InvoiceCorrectionRequest();
        request.setInvoiceDate("2026-08-07");
        request.setSupplierId(1L);
        invoiceService.correctInvoice(invoiceId, request).orElseThrow();
        invoiceService.submitForValidation(invoiceId).orElseThrow();
    }
}
