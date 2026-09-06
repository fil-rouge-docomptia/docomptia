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

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceArchiveControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final InvoiceStatusHistoryRepository statusHistoryRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    @Autowired
    InvoiceArchiveControllerIntegrationTest(
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
    void archivesExportedInvoiceAndRecordsArchivalDateAndHistory() throws Exception {
        Invoice invoice = createInvoice(InvoiceStatusCode.EXPORTEE);

        mockMvc.perform(post("/api/v1/invoices/{id}/archive", invoice.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceId").value(invoice.getInvoiceId()))
                .andExpect(jsonPath("$.status").value("ARCHIVEE"));

        Invoice archivedInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertEquals(InvoiceStatusCode.ARCHIVEE.getCode(), archivedInvoice.getInvoiceStatus().getCode());
        assertNotNull(archivedInvoice.getArchivedAt());

        List<InvoiceStatusHistory> history = archiveHistory(invoice);
        assertEquals(1, history.size());
        assertEquals(InvoiceStatusCode.ARCHIVEE.getCode(), history.getFirst().getInvoiceStatus().getCode());
        assertEquals(1L, history.getFirst().getChangedByUser().getUserId());
        assertEquals("Invoice archived", history.getFirst().getComment());

        mockMvc.perform(get("/api/v1/invoices/{id}", invoice.getInvoiceId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVEE"))
                .andExpect(jsonPath("$.archivedAt").value(archivedInvoice.getArchivedAt().toString()));
    }

    @ParameterizedTest
    @EnumSource(value = InvoiceStatusCode.class, names = "EXPORTEE", mode = EnumSource.Mode.EXCLUDE)
    void refusesArchivingForEveryStatusOtherThanExported(InvoiceStatusCode statusCode) throws Exception {
        Invoice invoice = createInvoice(statusCode);

        mockMvc.perform(post("/api/v1/invoices/{id}/archive", invoice.getInvoiceId()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(
                        statusCode == InvoiceStatusCode.ARCHIVEE
                                ? "ARCHIVED_INVOICE_NOT_MODIFIABLE"
                                : "INVOICE_ACTION_NOT_ALLOWED"
                ));

        Invoice unchangedInvoice = invoiceRepository.findById(invoice.getInvoiceId()).orElseThrow();
        assertEquals(statusCode.getCode(), unchangedInvoice.getInvoiceStatus().getCode());
        assertNull(unchangedInvoice.getArchivedAt());
        assertEquals(0, archiveHistory(invoice).size());
    }

    private Invoice createInvoice(InvoiceStatusCode statusCode) {
        LocalDateTime now = LocalDateTime.now();
        Invoice invoice = new Invoice();
        invoice.setOrganization(organizationRepository.findById(1L).orElseThrow());
        invoice.setCreatedByUser(userRepository.findById(1L).orElseThrow());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(statusCode.getCode()).orElseThrow());
        invoice.setInvoiceNumber("ARCHIVE-" + statusCode.getCode() + "-" + now);
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.saveAndFlush(invoice);
    }

    private List<InvoiceStatusHistory> archiveHistory(Invoice invoice) {
        return statusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        invoice.getInvoiceId(),
                        1L
                );
    }
}
