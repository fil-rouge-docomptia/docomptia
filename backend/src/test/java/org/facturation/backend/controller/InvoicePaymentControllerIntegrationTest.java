package org.facturation.backend.controller;

import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.InvoiceStatusHistory;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoicePaymentControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final InvoiceStatusHistoryRepository statusHistoryRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    @Autowired
    InvoicePaymentControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceRepository invoiceRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            InvoiceStatusHistoryRepository statusHistoryRepository,
            OrganizationRepository organizationRepository,
            UserRepository userRepository
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.statusHistoryRepository = statusHistoryRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
    }

    @Test
    void marksExportedInvoiceAsPaidAndRecordsTheAuthenticatedUser() throws Exception {
        Invoice invoice = createInvoice(InvoiceStatusCode.EXPORTEE);

        mockMvc.perform(post("/api/v1/invoices/{id}/mark-paid", invoice.getInvoiceId())
                        .contentType(APPLICATION_JSON)
                        .content("{\"paymentDate\":\"2026-09-05\",\"paymentReference\":\"VIR-2026-0042\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(invoice.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("PAYEE"));

        assertEquals("PAYEE", currentStatus(invoice));
        Invoice paidInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertEquals(LocalDate.of(2026, 9, 5), paidInvoice.getPaymentDate());
        assertEquals("VIR-2026-0042", paidInvoice.getPaymentReference());
        assertEquals(1L, paidInvoice.getPaidByUser().getUserId());
        var history = paymentHistory(invoice);
        assertEquals(1, history.size());
        assertEquals(1L, history.getFirst().getChangedByUser().getUserId());
        assertEquals("Invoice payment confirmed", history.getFirst().getComment());

        mockMvc.perform(get("/api/v1/invoices/{id}", invoice.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentDate").value("2026-09-05"))
                .andExpect(jsonPath("$.paymentReference").value("VIR-2026-0042"))
                .andExpect(jsonPath("$.paidByUserId").value(1));

        mockMvc.perform(get("/api/v1/invoices/{id}/history", invoice.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.action == 'PAYEE')].type").value("STATUS_CHANGE"))
                .andExpect(jsonPath("$[?(@.action == 'PAYEE')].authorId").value(1))
                .andExpect(jsonPath("$[?(@.action == 'PAYEE')].date").isNotEmpty())
                .andExpect(jsonPath("$[?(@.action == 'PAYEE')].comment")
                        .value("Invoice payment confirmed"));
    }

    @Test
    void repeatedPaymentConfirmationDoesNotDuplicateHistory() throws Exception {
        Invoice invoice = createInvoice(InvoiceStatusCode.EXPORTEE);

        mockMvc.perform(post("/api/v1/invoices/{id}/mark-paid", invoice.getInvoiceId())
                        .contentType(APPLICATION_JSON)
                        .content("{\"paymentDate\":\"2026-09-05\",\"paymentReference\":\"FIRST\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/invoices/{id}/mark-paid", invoice.getInvoiceId())
                        .contentType(APPLICATION_JSON)
                        .content("{\"paymentDate\":\"2026-09-06\",\"paymentReference\":\"SECOND\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYEE"));

        assertEquals(1, paymentHistory(invoice).size());
        Invoice paidInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertEquals(LocalDate.of(2026, 9, 5), paidInvoice.getPaymentDate());
        assertEquals("FIRST", paidInvoice.getPaymentReference());
    }

    @Test
    void requiresPaymentDate() throws Exception {
        Invoice invoice = createInvoice(InvoiceStatusCode.EXPORTEE);

        mockMvc.perform(post("/api/v1/invoices/{id}/mark-paid", invoice.getInvoiceId())
                        .contentType(APPLICATION_JSON)
                        .content("{\"paymentReference\":\"VIR-2026-0042\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("paymentDate is required"));

        Invoice unpaidInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertEquals("EXPORTEE", unpaidInvoice.getInvoiceStatus().getCode());
        assertNull(unpaidInvoice.getPaymentReference());
        assertNull(unpaidInvoice.getPaidByUser());
    }

    @ParameterizedTest
    @EnumSource(
            value = InvoiceStatusCode.class,
            names = {"EXPORTEE", "PAYEE"},
            mode = EnumSource.Mode.EXCLUDE
    )
    void refusesPaymentConfirmationForEveryIncompatibleStatus(InvoiceStatusCode statusCode) throws Exception {
        Invoice invoice = createInvoice(statusCode);

        mockMvc.perform(post("/api/v1/invoices/{id}/mark-paid", invoice.getInvoiceId())
                        .contentType(APPLICATION_JSON)
                        .content("{\"paymentDate\":\"2026-09-05\",\"paymentReference\":\"VIR-2026-0042\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(
                        statusCode == InvoiceStatusCode.ARCHIVEE
                                ? "ARCHIVED_INVOICE_NOT_MODIFIABLE"
                                : "INVOICE_ACTION_NOT_ALLOWED"
                ));

        assertEquals(statusCode.getCode(), currentStatus(invoice));
        assertEquals(0, paymentHistory(invoice).size());
        Invoice unpaidInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertNull(unpaidInvoice.getPaymentDate());
        assertNull(unpaidInvoice.getPaymentReference());
        assertNull(unpaidInvoice.getPaidByUser());
    }

    private Invoice createInvoice(InvoiceStatusCode statusCode) {
        LocalDateTime now = LocalDateTime.now();
        Invoice invoice = new Invoice();
        invoice.setOrganization(organizationRepository.findById(1L).orElseThrow());
        invoice.setCreatedByUser(userRepository.findById(1L).orElseThrow());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(statusCode.getCode()).orElseThrow());
        invoice.setInvoiceNumber("PAYMENT-" + statusCode.getCode() + "-" + now.toString());
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.saveAndFlush(invoice);
    }

    private String currentStatus(Invoice invoice) {
        return invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow().getInvoiceStatus().getCode();
    }

    private List<InvoiceStatusHistory> paymentHistory(Invoice invoice) {
        return statusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        invoice.getInvoiceId(),
                        1L
                );
    }
}
