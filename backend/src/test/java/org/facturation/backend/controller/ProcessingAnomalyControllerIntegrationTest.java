package org.facturation.backend.controller;

import org.facturation.backend.dto.response.ProcessingAnomalyResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.ProcessingAnomalyCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.ProcessingAnomalyRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.ProcessingAnomalyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@WithMockUser(username = "admin@facturation-demo.fr", roles = "ADMIN")
class ProcessingAnomalyControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProcessingAnomalyService processingAnomalyService;

    @Autowired
    private ProcessingAnomalyRepository processingAnomalyRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void createsOnlyOneActiveAnomalyForAnInvoiceAndExposesItToTheDashboard() throws Exception {
        Invoice invoice = createInvoice("KAN-351-CREATE");

        ProcessingAnomalyResponse created = processingAnomalyService.create(
                invoice.getInvoiceId(), ProcessingAnomalyCode.OCR_INCOMPLETE
        );
        ProcessingAnomalyResponse duplicateCreation = processingAnomalyService.create(
                invoice.getInvoiceId(), ProcessingAnomalyCode.OCR_INCOMPLETE
        );

        assertEquals(created.id(), duplicateCreation.id());
        assertEquals(1, processingAnomalyRepository.count());
        mockMvc.perform(get("/api/v1/dashboard/anomalies")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].invoiceId").value(invoice.getInvoiceId()))
                .andExpect(jsonPath("$[0].organizationId").value(1))
                .andExpect(jsonPath("$[0].code").value("OCR_INCOMPLETE"))
                .andExpect(jsonPath("$[0].label").value("OCR incomplet"))
                .andExpect(jsonPath("$[0].description").isNotEmpty())
                .andExpect(jsonPath("$[0].blocking").value(true))
                .andExpect(jsonPath("$[0].resolvedAt").doesNotExist());
    }

    @Test
    void resolvesAnomalyIdempotentlyAndRemovesItFromBlockingDashboardResults() throws Exception {
        Invoice invoice = createInvoice("KAN-351-RESOLVE");
        ProcessingAnomalyResponse created = processingAnomalyService.create(
                invoice.getInvoiceId(), ProcessingAnomalyCode.UNBALANCED_ACCOUNTING_ENTRY
        );

        mockMvc.perform(patch(
                "/api/v1/invoices/{invoiceId}/anomalies/{anomalyId}/resolve",
                        invoice.getInvoiceId(),
                        created.id()
                ).header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocking").value(false))
                .andExpect(jsonPath("$.resolvedAt").isNotEmpty());

        var resolved = processingAnomalyRepository.findById(created.id()).orElseThrow();
        LocalDateTime firstResolutionDate = resolved.getResolvedAt();
        assertNotNull(firstResolutionDate);
        assertEquals(1L, resolved.getResolvedByUser().getUserId());

        mockMvc.perform(patch(
                "/api/v1/invoices/{invoiceId}/anomalies/{anomalyId}/resolve",
                        invoice.getInvoiceId(),
                        created.id()
                ).header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk());
        assertEquals(firstResolutionDate, resolved.getResolvedAt());

        mockMvc.perform(get("/api/v1/dashboard/anomalies")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(get("/api/v1/dashboard/anomalies")
                        .param("includeResolved", "true")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(created.id()))
                .andExpect(jsonPath("$[0].blocking").value(false));
    }

    @Test
    void doesNotResolveAnomalyThroughAnotherInvoice() throws Exception {
        Invoice anomalyInvoice = createInvoice("KAN-351-OWNER");
        Invoice otherInvoice = createInvoice("KAN-351-OTHER");
        ProcessingAnomalyResponse created = processingAnomalyService.create(
                anomalyInvoice.getInvoiceId(), ProcessingAnomalyCode.EXPORT_ERROR
        );

        mockMvc.perform(patch(
                "/api/v1/invoices/{invoiceId}/anomalies/{anomalyId}/resolve",
                        otherInvoice.getInvoiceId(),
                        created.id()
                ).header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PROCESSING_ANOMALY_NOT_FOUND"));

        assertNull(processingAnomalyRepository.findById(created.id()).orElseThrow().getResolvedAt());
    }

    private Invoice createInvoice(String invoiceNumber) {
        User user = userRepository.findById(1L).orElseThrow();
        LocalDateTime now = LocalDateTime.now();
        Invoice invoice = new Invoice();
        invoice.setOrganization(user.getOrganization());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(InvoiceStatusCode.EXTRAITE.getCode()).orElseThrow());
        invoice.setCreatedByUser(user);
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.saveAndFlush(invoice);
    }

    private String loginAndGetToken() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@facturation-demo.fr","password":"admin123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("token").asText();
    }
}
