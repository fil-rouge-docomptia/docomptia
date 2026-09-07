package org.facturation.backend.service.impl;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.ExportBatch;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ExportBatchRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.AccountingExportFailureAuditService;
import org.facturation.backend.service.AccountingExportValidator;
import org.facturation.backend.service.AccountingExportValidator.ValidatedEntry;
import org.facturation.backend.service.AccountingPieceNumberService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.facturation.backend.service.storage.AccountingExportFileStorageService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountingExportServiceImplTest {

    @Test
    void doesNotMarkInvoicesExportedWhenFileStorageFails() {
        InvoiceRepository invoiceRepository = mock(InvoiceRepository.class);
        AccountingExportValidator accountingExportValidator = mock(AccountingExportValidator.class);
        AccountingPieceNumberService accountingPieceNumberService = mock(AccountingPieceNumberService.class);
        AuditLogRepository auditLogRepository = mock(AuditLogRepository.class);
        ExportBatchRepository exportBatchRepository = mock(ExportBatchRepository.class);
        CurrentUserService currentUserService = mock(CurrentUserService.class);
        InvoiceStatusWorkflowService invoiceStatusWorkflowService = mock(InvoiceStatusWorkflowService.class);
        AccountingExportFileStorageService fileStorageService = mock(AccountingExportFileStorageService.class);
        AccountingExportFailureAuditService failureAuditService = mock(AccountingExportFailureAuditService.class);
        AccountingExportServiceImpl service = new AccountingExportServiceImpl(
                invoiceRepository,
                accountingExportValidator,
                accountingPieceNumberService,
                auditLogRepository,
                exportBatchRepository,
                currentUserService,
                invoiceStatusWorkflowService,
                fileStorageService,
                failureAuditService
        );

        Organization organization = new Organization();
        organization.setOrganizationId(1L);
        User user = new User();
        user.setOrganization(organization);
        Invoice invoice = new Invoice();
        invoice.setInvoiceId(10L);
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(invoice);

        when(currentUserService.getCurrentUser()).thenReturn(user);
        when(accountingPieceNumberService.lockSequence(organization.getOrganizationId())).thenReturn(organization);
        when(invoiceRepository.findAccountingExportCandidates(organization.getOrganizationId(), false, null, false, null))
                .thenReturn(List.of(invoice));
        when(accountingExportValidator.validate(List.of(invoice)))
                .thenReturn(List.of(new ValidatedEntry(entry, List.of())));
        when(exportBatchRepository.save(any(ExportBatch.class))).thenAnswer(invocation -> {
            ExportBatch batch = invocation.getArgument(0);
            batch.setExportBatchId(20L);
            return batch;
        });
        when(fileStorageService.store(any(byte[].class), anyString(), anyLong()))
                .thenThrow(new IllegalStateException("Storage unavailable"));

        assertThrows(IllegalStateException.class, () -> service.exportCsv(null, null));

        verify(invoiceStatusWorkflowService, never()).transitionTo(any(), any(), any(), anyString());
        verify(auditLogRepository, never()).save(any());
        verify(failureAuditService).record(
                eq(user),
                eq(null),
                eq(null),
                eq(List.of(invoice)),
                eq(ExportBatchFormat.CSV),
                any(IllegalStateException.class)
        );
    }
}
