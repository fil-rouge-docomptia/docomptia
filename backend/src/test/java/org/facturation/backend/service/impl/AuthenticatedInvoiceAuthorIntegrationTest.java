package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@Transactional
class AuthenticatedInvoiceAuthorIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceStatusHistoryRepository invoiceStatusHistoryRepository;

    @Autowired
    AuthenticatedInvoiceAuthorIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            InvoiceStatusHistoryRepository invoiceStatusHistoryRepository
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceStatusHistoryRepository = invoiceStatusHistoryRepository;
    }

    @Test
    void refusesBusinessActionWithoutAuthenticatedUser() {
        assertThrows(
                AuthenticationCredentialsNotFoundException.class,
                () -> invoiceService.uploadAndAnalyze(invoiceFile(), null)
        );
    }

    @Test
    @WithMockUser(username = "operator@facturation-demo.fr")
    @Sql(statements = "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, "
            + "password_hash, is_active, created_at, updated_at) VALUES (200, 1, 1, 'Operator', 'Test', "
            + "'operator@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', "
            + "true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
    void attributesInvoiceAndHistoryToAuthenticatedUser() {
        InvoiceUploadResponse response = invoiceService.uploadAndAnalyze(invoiceFile(), null);

        assertEquals(
                200L,
                invoiceRepository.findById(response.getInvoiceId()).orElseThrow().getCreatedByUser().getUserId()
        );
        invoiceStatusHistoryRepository
                .findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                        response.getInvoiceId(),
                        1L
                )
                .forEach(history -> assertEquals(200L, history.getChangedByUser().getUserId()));
    }

    private MockMultipartFile invoiceFile() {
        return new MockMultipartFile(
                "file",
                "invoice.png",
                "image/png",
                new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
        );
    }
}
