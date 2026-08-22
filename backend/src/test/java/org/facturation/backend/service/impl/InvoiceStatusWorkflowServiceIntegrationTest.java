package org.facturation.backend.service.impl;

import org.facturation.backend.exception.InvoiceStatusTransitionException;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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
        assertNotNull(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.A_VERIFIER));
        assertNotNull(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.EXPORTABLE));
        assertNotNull(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.EXPORTEE));
        assertNotNull(invoiceStatusWorkflowService.findByCode(InvoiceStatusCode.ARCHIVEE));
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

    @Test
    void allowsAccountingEntryGenerationForValidatedInvoice() {
        Invoice invoice = invoiceWithStatus(InvoiceStatusCode.VALIDEE);

        assertDoesNotThrow(() -> invoiceStatusWorkflowService.ensureCanGenerateAccountingEntry(invoice));
    }

    @ParameterizedTest
    @EnumSource(value = InvoiceStatusCode.class, names = "VALIDEE", mode = EnumSource.Mode.EXCLUDE)
    void blocksAccountingEntryGenerationForEveryNonValidatedStatus(InvoiceStatusCode statusCode) {
        Invoice invoice = invoiceWithStatus(statusCode);

        InvoiceStatusTransitionException exception = assertThrows(
                InvoiceStatusTransitionException.class,
                () -> invoiceStatusWorkflowService.ensureCanGenerateAccountingEntry(invoice)
        );

        assertEquals(
                "Invoice 42 cannot generate an accounting entry; expected step: validate the invoice from status "
                        + statusCode.getCode(),
                exception.getMessage()
        );
    }

    private Invoice invoiceWithStatus(InvoiceStatusCode statusCode) {
        Invoice invoice = new Invoice();
        invoice.setInvoiceId(42L);
        invoice.setInvoiceStatus(invoiceStatusWorkflowService.findByCode(statusCode));
        return invoice;
    }
}
