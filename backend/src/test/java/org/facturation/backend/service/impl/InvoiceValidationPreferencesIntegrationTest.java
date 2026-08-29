package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.service.InvoiceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@Transactional
@org.springframework.security.test.context.support.WithMockUser(username = "admin@facturation-demo.fr")
class InvoiceValidationPreferencesIntegrationTest {

    private final InvoiceService invoiceService;
    private final InvoiceRepository invoiceRepository;
    private final OrganizationRepository organizationRepository;

    @Autowired
    InvoiceValidationPreferencesIntegrationTest(
            InvoiceService invoiceService,
            InvoiceRepository invoiceRepository,
            OrganizationRepository organizationRepository
    ) {
        this.invoiceService = invoiceService;
        this.invoiceRepository = invoiceRepository;
        this.organizationRepository = organizationRepository;
    }

    @Test
    void validatesDirectlyWhenOrganizationDoesNotRequireValidation() {
        configureValidation(false, null);
        Long invoiceId = uploadCompleteInvoice();

        invoiceService.submitForValidation(invoiceId).orElseThrow();

        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), persistedStatus(invoiceId));
    }

    @Test
    void validatesDirectlyBelowTheOrganizationThreshold() {
        configureValidation(true, new BigDecimal("150.00"));
        Long invoiceId = uploadCompleteInvoice();

        invoiceService.submitForValidation(invoiceId).orElseThrow();

        assertEquals(InvoiceStatusCode.VALIDEE.getCode(), persistedStatus(invoiceId));
    }

    @Test
    void waitsForValidationAtTheOrganizationThreshold() {
        configureValidation(true, new BigDecimal("120.00"));
        Long invoiceId = uploadCompleteInvoice();

        invoiceService.submitForValidation(invoiceId).orElseThrow();

        assertEquals(InvoiceStatusCode.A_VERIFIER.getCode(), persistedStatus(invoiceId));
    }

    private void configureValidation(boolean required, BigDecimal threshold) {
        Organization organization = organizationRepository.findById(1L).orElseThrow();
        organization.setValidationRequired(required);
        organization.setValidationThreshold(threshold);
        organizationRepository.saveAndFlush(organization);
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

    private String persistedStatus(Long invoiceId) {
        return invoiceRepository.findById(invoiceId).orElseThrow().getInvoiceStatus().getCode();
    }
}
