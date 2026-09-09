package org.facturation.backend.controller;

import jakarta.persistence.EntityManager;
import org.facturation.backend.exception.ApiExceptionHandler;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceAdministrativeDeletionControllerIntegrationTest {

    private final MockMvc mockMvc;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceStatusRepository invoiceStatusRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final EntityManager entityManager;

    @Autowired
    InvoiceAdministrativeDeletionControllerIntegrationTest(
            InvoiceController invoiceController,
            ApiExceptionHandler apiExceptionHandler,
            InvoiceRepository invoiceRepository,
            InvoiceFileRepository invoiceFileRepository,
            InvoiceStatusRepository invoiceStatusRepository,
            OrganizationRepository organizationRepository,
            UserRepository userRepository,
            AuditLogRepository auditLogRepository,
            EntityManager entityManager
    ) {
        this.mockMvc = MockMvcBuilders.standaloneSetup(invoiceController)
                .setControllerAdvice(apiExceptionHandler)
                .build();
        this.invoiceRepository = invoiceRepository;
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.entityManager = entityManager;
    }

    @Test
    void administrativelyDeletesEligibleInvoiceAndKeepsFileRelationsAndAudit() throws Exception {
        Invoice invoice = createInvoice(InvoiceStatusCode.EXTRAITE);
        InvoiceFile invoiceFile = createInvoiceFile(invoice);

        mockMvc.perform(delete("/api/v1/invoices/{id}", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"  Created by mistake  \"}"))
                .andExpect(status().isNoContent());

        entityManager.flush();
        entityManager.clear();
        assertThat(invoiceRepository.findById(invoice.getInvoiceId())).isEmpty();
        assertThat(invoiceFileRepository.findById(invoiceFile.getInvoiceFileId())).isPresent();

        Object[] deletion = (Object[]) entityManager.createNativeQuery("""
                        SELECT deleted_at, deleted_by_user_id, deletion_reason
                        FROM invoices
                        WHERE invoice_id = :invoiceId
                        """)
                .setParameter("invoiceId", invoice.getInvoiceId())
                .getSingleResult();
        assertThat(deletion[0]).isNotNull();
        assertThat(((Number) deletion[1]).longValue()).isEqualTo(1L);
        assertThat(deletion[2]).isEqualTo("Created by mistake");

        List<AuditLog> auditLogs = deletionAuditLogs(invoice.getInvoiceId());
        assertThat(auditLogs).singleElement().satisfies(auditLog -> {
            assertThat(auditLog.getUser().getUserId()).isEqualTo(1L);
            assertThat(auditLog.getCreatedAt()).isNotNull();
            assertThat(auditLog.getOldValue()).isEqualTo("status=EXTRAITE");
            assertThat(auditLog.getNewValue()).isEqualTo("reason=Created by mistake");
        });

        mockMvc.perform(get("/api/v1/invoices/{id}", invoice.getInvoiceId()))
                .andExpect(status().isNotFound());
    }

    @Test
    void requiresAdministrativeDeletionReason() throws Exception {
        Invoice invoice = createInvoice(InvoiceStatusCode.EXTRAITE);

        mockMvc.perform(delete("/api/v1/invoices/{id}", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVOICE_VALIDATION_ERROR"));

        assertThat(invoiceRepository.findById(invoice.getInvoiceId())).isPresent();
        assertThat(deletionAuditLogs(invoice.getInvoiceId())).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(value = InvoiceStatusCode.class, names = {
            "COMPTABILISEE", "VALIDEE", "EXPORTABLE", "EXPORTEE", "PAYEE", "ARCHIVEE"
    })
    void refusesAdministrativeDeletionForProtectedStatuses(InvoiceStatusCode statusCode) throws Exception {
        Invoice invoice = createInvoice(statusCode);

        mockMvc.perform(delete("/api/v1/invoices/{id}", invoice.getInvoiceId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Created by mistake\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVOICE_DELETION_NOT_ALLOWED"))
                .andExpect(jsonPath("$.message").value(
                        "Invoice cannot be administratively deleted from status " + statusCode.getCode()
                ));

        assertThat(invoiceRepository.findById(invoice.getInvoiceId())).isPresent();
        assertThat(deletionAuditLogs(invoice.getInvoiceId())).isEmpty();
    }

    private Invoice createInvoice(InvoiceStatusCode statusCode) {
        LocalDateTime now = LocalDateTime.now();
        Invoice invoice = new Invoice();
        invoice.setOrganization(organizationRepository.findById(1L).orElseThrow());
        invoice.setCreatedByUser(userRepository.findById(1L).orElseThrow());
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode(statusCode.getCode()).orElseThrow());
        invoice.setInvoiceNumber("ADMIN-DELETE-" + statusCode.getCode() + "-" + now);
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(now);
        invoice.setUpdatedAt(now);
        return invoiceRepository.saveAndFlush(invoice);
    }

    private InvoiceFile createInvoiceFile(Invoice invoice) {
        InvoiceFile invoiceFile = new InvoiceFile();
        invoiceFile.setInvoice(invoice);
        invoiceFile.setOriginalFileName("created-by-mistake.pdf");
        invoiceFile.setStoredFileName("stored-created-by-mistake.pdf");
        invoiceFile.setFilePath("/retained/created-by-mistake.pdf");
        invoiceFile.setMimeType("application/pdf");
        invoiceFile.setFileSize(10L);
        invoiceFile.setUploadedAt(LocalDateTime.now());
        return invoiceFileRepository.saveAndFlush(invoiceFile);
    }

    private List<AuditLog> deletionAuditLogs(Long invoiceId) {
        return auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        1L,
                        Invoice.class.getSimpleName(),
                        invoiceId,
                        "ADMINISTRATIVELY_DELETED"
                );
    }
}
