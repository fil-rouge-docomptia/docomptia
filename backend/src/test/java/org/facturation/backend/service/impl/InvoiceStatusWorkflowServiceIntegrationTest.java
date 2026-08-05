package org.facturation.backend.service.impl;

import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
class InvoiceStatusWorkflowServiceIntegrationTest {

    private final InvoiceStatusRepository invoiceStatusRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;

    @Autowired
    InvoiceStatusWorkflowServiceIntegrationTest(
            InvoiceStatusRepository invoiceStatusRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService
    ) {
        this.invoiceStatusRepository = invoiceStatusRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
    }

    @Test
    void alignsJavaStatusCodesWithSeededDatabaseStatuses() {
        Set<String> databaseStatusCodes = invoiceStatusRepository.findAll().stream()
                .map(InvoiceStatus::getCode)
                .collect(Collectors.toSet());
        Set<String> javaStatusCodes = Arrays.stream(InvoiceStatusCode.values())
                .map(InvoiceStatusCode::getCode)
                .collect(Collectors.toSet());

        assertEquals(databaseStatusCodes, javaStatusCodes);
        assertNotNull(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.VALIDEE));
        assertNotNull(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.REJETEE));
    }

    @Test
    void throwsExplicitErrorForUnknownStatusCode() {
        IllegalStateException exception = assertThrows(
                IllegalStateException.class,
                () -> invoiceStatusWorkflowService.findByCode("INCONNU")
        );

        assertEquals("Invoice status INCONNU not found", exception.getMessage());
    }
}
