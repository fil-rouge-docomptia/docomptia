package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.SupplierNotFoundException;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusHistoryRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Pageable;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

    @Test
    @WithMockUser(username = "outsider@facturation-demo.fr")
    @Sql(statements = {
            "INSERT INTO organizations (organization_id, name, legal_name, siret, email, created_at, updated_at) "
                    + "VALUES (2, 'Other organization', 'Other organization SARL', '98765432109876', "
                    + "'contact@other-organization.fr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                    + "is_active, created_at, updated_at) VALUES (201, 2, 1, 'Other', 'User', "
                    + "'outsider@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', "
                    + "true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    })
    void attributesInvoiceToAuthenticatedUserOrganization() {
        InvoiceUploadResponse response = invoiceService.uploadAndAnalyze(invoiceFile(), null);

        assertEquals(
                2L,
                invoiceRepository.findById(response.getInvoiceId()).orElseThrow().getOrganization().getOrganizationId()
        );
    }

    @Test
    @WithMockUser(username = "outsider@facturation-demo.fr")
    @Sql(statements = {
            "INSERT INTO organizations (organization_id, name, legal_name, siret, email, created_at, updated_at) "
                    + "VALUES (2, 'Other organization', 'Other organization SARL', '98765432109876', "
                    + "'contact@other-organization.fr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                    + "is_active, created_at, updated_at) VALUES (201, 2, 1, 'Other', 'User', "
                    + "'outsider@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', "
                    + "true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    })
    void rejectsSupplierFromAnotherOrganizationDuringUpload() {
        long invoiceCountBefore = invoiceRepository.count();

        assertThrows(SupplierNotFoundException.class, () -> invoiceService.uploadAndAnalyze(invoiceFile(), 1L));

        assertEquals(invoiceCountBefore, invoiceRepository.count());
    }

    @Test
    @WithMockUser(username = "outsider@facturation-demo.fr")
    @Sql(statements = {
            "INSERT INTO organizations (organization_id, name, legal_name, siret, email, created_at, updated_at) "
                    + "VALUES (2, 'Other organization', 'Other organization SARL', '98765432109876', "
                    + "'contact@other-organization.fr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                    + "is_active, created_at, updated_at) VALUES (201, 2, 1, 'Other', 'User', "
                    + "'outsider@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', "
                    + "true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    })
    void listsOnlyInvoicesFromAuthenticatedUserOrganization() {
        assertTrue(invoiceService.searchInvoices(
                null, null, null, null, null, null, null, null, Pageable.unpaged()).isEmpty());
    }

    @Test
    @WithMockUser(username = "outsider@facturation-demo.fr")
    @Sql(statements = {
            "INSERT INTO organizations (organization_id, name, legal_name, siret, email, created_at, updated_at) "
                    + "VALUES (2, 'Other organization', 'Other organization SARL', '98765432109876', "
                    + "'contact@other-organization.fr', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                    + "is_active, created_at, updated_at) VALUES (201, 2, 1, 'Other', 'User', "
                    + "'outsider@facturation-demo.fr', '$2y$10$KUfJnN7ROhgbS3HTUJbNQeyesH5EFAlgvhkyw3Kf9UdX.DdsROjd6', "
                    + "true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            "INSERT INTO invoices (invoice_id, organization_id, supplier_id, invoice_status_id, created_by_user_id, "
                    + "invoice_number, invoice_date, currency_code, total_ht, total_tva, total_ttc, created_at, updated_at) "
                    + "VALUES (300, 1, 1, 3, 1, 'INV-300', CURRENT_DATE, 'EUR', 100.00, 20.00, 120.00, "
                    + "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    })
    void preventsAuthenticatedUserFromSubmittingAnotherOrganizationInvoice() {
        assertTrue(invoiceService.submitForValidation(300L).isEmpty());
        assertEquals("EXTRAITE", invoiceRepository.findById(300L).orElseThrow().getInvoiceStatus().getCode());
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
