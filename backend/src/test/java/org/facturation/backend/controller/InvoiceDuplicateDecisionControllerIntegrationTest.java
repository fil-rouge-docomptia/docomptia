package org.facturation.backend.controller;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.facturation.backend.repository.InvoiceDuplicateAlertRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@Import(InvoiceDuplicateDecisionControllerIntegrationTest.DuplicateDecisionOcrConfiguration.class)
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceDuplicateDecisionControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceService invoiceService;
    private final InvoiceDuplicateAlertRepository duplicateAlertRepository;

    @Autowired
    InvoiceDuplicateDecisionControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceService invoiceService,
            InvoiceDuplicateAlertRepository duplicateAlertRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceService = invoiceService;
        this.duplicateAlertRepository = duplicateAlertRepository;
    }

    @Test
    void ignoresPendingAlertAndMovesInvoiceToReview() throws Exception {
        DuplicateFixture fixture = duplicateFixture();

        mockMvc.perform(post(
                                "/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision",
                                fixture.invoiceId(),
                                fixture.alertId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"decision": "IGNORE", "reason": "Two distinct purchases"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("A_VERIFIER"))
                .andExpect(jsonPath("$.duplicateAlerts[0].alertId").value(fixture.alertId()))
                .andExpect(jsonPath("$.duplicateAlerts[0].decision").value("IGNORE"))
                .andExpect(jsonPath("$.duplicateAlerts[0].decisionReason").value("Two distinct purchases"))
                .andExpect(jsonPath("$.duplicateAlerts[0].decidedByUserId").value(1))
                .andExpect(jsonPath("$.duplicateAlerts[0].decidedAt").isNotEmpty());

        InvoiceDuplicateAlert alert = duplicateAlertRepository.findById(fixture.alertId()).orElseThrow();
        assertEquals(DuplicateAlertDecision.IGNORE, alert.getDecision());
        assertNotNull(alert.getDecidedAt());
        assertEquals(1L, alert.getDecidedByUser().getUserId());
    }

    @Test
    void confirmsPendingDuplicateAndRefusesASecondDecision() throws Exception {
        DuplicateFixture fixture = duplicateFixture();

        mockMvc.perform(post(
                                "/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision",
                                fixture.invoiceId(),
                                fixture.alertId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\": \"CONFIRM\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJETEE"))
                .andExpect(jsonPath("$.duplicateAlerts[0].decision").value("CONFIRM"));

        mockMvc.perform(post(
                                "/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision",
                                fixture.invoiceId(),
                                fixture.alertId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\": \"IGNORE\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ALERT_ACTION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Duplicate alert " + fixture.alertId() + " cannot receive a decision from status CONFIRM"
                ));
    }

    @Test
    void refusesInvoiceValidationWhileDuplicateDecisionIsPending() throws Exception {
        DuplicateFixture fixture = duplicateFixture();

        mockMvc.perform(post("/api/v1/invoices/{invoiceId}/validate", fixture.invoiceId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_ALERT_ACTION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice " + fixture.invoiceId()
                                + " cannot be validated while a duplicate alert is pending"
                ));
    }

    @Test
    void rejectsInvoiceWithAReasonAndKeepsAlertPendingWhenReasonIsMissing() throws Exception {
        DuplicateFixture fixture = duplicateFixture();

        mockMvc.perform(post(
                                "/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision",
                                fixture.invoiceId(),
                                fixture.alertId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\": \"REJECT\", \"reason\": \" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Rejection reason is required"));

        InvoiceDuplicateAlert pendingAlert = duplicateAlertRepository.findById(fixture.alertId()).orElseThrow();
        assertEquals(DuplicateAlertDecision.PENDING, pendingAlert.getDecision());
        assertNull(pendingAlert.getDecidedAt());

        mockMvc.perform(post(
                                "/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision",
                                fixture.invoiceId(),
                                fixture.alertId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\": \"REJECT\", \"reason\": \"Document sent by mistake\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJETEE"))
                .andExpect(jsonPath("$.duplicateAlerts[0].decision").value("REJECT"))
                .andExpect(jsonPath("$.duplicateAlerts[0].decisionReason").value("Document sent by mistake"));
    }

    @Test
    void returnsDuplicateDecisionInInvoiceHistory() throws Exception {
        DuplicateFixture fixture = duplicateFixture();

        mockMvc.perform(post(
                                "/api/v1/invoices/{invoiceId}/duplicate-alerts/{alertId}/decision",
                                fixture.invoiceId(),
                                fixture.alertId()
                        )
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"decision": "IGNORE", "reason": "Two distinct purchases"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/invoices/{invoiceId}/history", fixture.invoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')]").value(hasSize(1)))
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')].action").value(hasItem("IGNORE")))
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')].duplicateAlertId")
                        .value(hasItem(fixture.alertId().intValue())))
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')].authorId").value(hasItem(1)))
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')].author")
                        .value(hasItem("Admin Demo")))
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')].date")
                        .value(everyItem(notNullValue())))
                .andExpect(jsonPath("$[?(@.type == 'DUPLICATE_DECISION')].comment")
                        .value(hasItem("Two distinct purchases")));
    }

    private DuplicateFixture duplicateFixture() {
        invoiceService.uploadAndAnalyze(invoiceFile("first.png"), 1L);
        InvoiceUploadResponse duplicate = invoiceService.uploadAndAnalyze(invoiceFile("second.png"), 1L);
        Long alertId = duplicateAlertRepository
                .findByInvoiceInvoiceIdOrderByCreatedAtAsc(duplicate.getInvoiceId())
                .getFirst()
                .getDuplicateAlertId();
        return new DuplicateFixture(duplicate.getInvoiceId(), alertId);
    }

    private MockMultipartFile invoiceFile(String filename) {
        return new MockMultipartFile(
                "file",
                filename,
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
    }

    private record DuplicateFixture(Long invoiceId, Long alertId) {
    }

    static class DuplicateDecisionOcrClient implements OcrClient {

        @Override
        public OcrAnalysisResponse analyze(MultipartFile file) {
            OcrAnalysisResponse response = new OcrAnalysisResponse();
            response.setStatus("SUCCESS");
            response.setEngineName("duplicate-decision-test-ocr");
            response.setEngineVersion("1.0");
            response.setFields(List.of(field("invoiceNumber", "DUPLICATE-001")));
            return response;
        }

        private OcrFieldResponse field(String name, String value) {
            OcrFieldResponse field = new OcrFieldResponse();
            field.setFieldName(name);
            field.setRawValue(value);
            field.setNormalizedValue(value);
            return field;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class DuplicateDecisionOcrConfiguration {

        @Bean
        @Primary
        DuplicateDecisionOcrClient duplicateDecisionOcrClient() {
            return new DuplicateDecisionOcrClient();
        }
    }
}
