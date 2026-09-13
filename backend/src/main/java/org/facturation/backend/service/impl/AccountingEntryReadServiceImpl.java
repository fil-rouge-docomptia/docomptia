package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.facturation.backend.dto.response.AccountingEntryDiagnosticResponse;
import org.facturation.backend.dto.response.AccountingJournalResponse;
import org.facturation.backend.exception.AccountingEntryNotFoundException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.AccountingEntryExportStatus;
import org.facturation.backend.model.AccountingJournal;
import org.facturation.backend.model.ExportBatch;
import org.facturation.backend.model.ExportBatchStatusCode;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingJournalRepository;
import org.facturation.backend.service.AccountingExportValidator;
import org.facturation.backend.service.AccountingEntryReadService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AccountingEntryReadServiceImpl implements AccountingEntryReadService {
    private final AccountingEntryRepository entries;
    private final AccountingEntryLineRepository lines;
    private final AccountingEntryMapper mapper;
    private final CurrentUserService currentUserService;
    private final AccountingJournalRepository journals;
    private final AccountingExportValidator validator;

    public AccountingEntryReadServiceImpl(AccountingEntryRepository entries, AccountingEntryLineRepository lines,
            AccountingEntryMapper mapper, CurrentUserService currentUserService,
            AccountingJournalRepository journals, AccountingExportValidator validator) {
        this.entries = entries;
        this.lines = lines;
        this.mapper = mapper;
        this.currentUserService = currentUserService;
        this.journals = journals;
        this.validator = validator;
    }

    @Override
    public Page<AccountingEntryReadResponse> findPage(String query, Boolean balanced,
            AccountingEntryStatusCode status, LocalDate startDate, LocalDate endDate,
            Long journalId, AccountingEntryExportStatus exportStatus, Pageable pageable) {
        return entries.findReadPage(organizationId(), query.trim().toLowerCase(Locale.ROOT),
                balanced, status == null ? null : status.getCode(),
                startDate != null, startDate, endDate != null, endDate, journalId,
                exportStatus == null ? null : exportStatus == AccountingEntryExportStatus.EXPORTED,
                pageable).map(this::toResponse);
    }

    @Override
    public Page<AccountingJournalResponse> findJournals(Pageable pageable) {
        return journals.findByOrganizationOrganizationId(organizationId(), pageable).map(this::toJournalResponse);
    }

    @Override
    public AccountingEntryReadResponse findDetails(Long id) {
        return toResponse(entries.findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(id, organizationId())
                .orElseThrow(() -> new AccountingEntryNotFoundException(id)));
    }

    private Long organizationId() {
        return currentUserService.getCurrentUser().getOrganization().getOrganizationId();
    }

    private AccountingEntryReadResponse toResponse(AccountingEntry entry) {
        Invoice invoice = entry.getInvoice();
        var entryLines = lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entry.getAccountingEntryId());
        List<AccountingEntryDiagnosticResponse> diagnostics = validator.inspectEntry(entry, entryLines);
        AccountingJournal journal = entry.getJournal();
        if (journal == null) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("JOURNAL_NOT_ASSIGNED",
                    "No journal has been assigned to this entry", false, null));
        } else if (!journal.getOrganization().getOrganizationId().equals(invoice.getOrganization().getOrganizationId())) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("JOURNAL_OUTSIDE_ORGANIZATION",
                    "The journal does not belong to the entry organization", true, null));
            journal = null;
        } else if (!journal.isActive()) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("JOURNAL_INACTIVE",
                    "The assigned journal is inactive", false, null));
        }
        ExportBatch batch = entry.getExportBatch();
        if (batch != null && !batch.getOrganization().getOrganizationId().equals(invoice.getOrganization().getOrganizationId())) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("EXPORT_BATCH_OUTSIDE_ORGANIZATION",
                    "The export batch does not belong to the entry organization", true, null));
            batch = null;
        }
        boolean exported = batch != null && (ExportBatchStatusCode.GENERE.getCode().equals(batch.getStatus())
                || ExportBatchStatusCode.ARCHIVE.getCode().equals(batch.getStatus()));
        if (batch != null && !exported) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("EXPORT_BATCH_NOT_FINALIZED",
                    "The entry is linked to an export batch that has not completed", true, null));
        }
        if (!exported && (entry.getReversedAccountingEntry() != null
                || !AccountingEntryStatusCode.GENERATED.getCode().equals(entry.getStatus()))) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("ENTRY_EXPORT_WORKFLOW_UNAVAILABLE",
                    "The current invoice export workflow does not export reversals or corrective entries", true, null));
        } else if (!exported && (!InvoiceStatusCode.EXPORTABLE.getCode().equals(invoice.getInvoiceStatus().getCode())
                || invoice.getExportBatch() != null)) {
            diagnostics.add(new AccountingEntryDiagnosticResponse("INVOICE_NOT_EXPORTABLE",
                    "The current invoice export workflow requires an EXPORTABLE invoice without an export batch", true, null));
        }
        boolean needsAttention = diagnostics.stream().anyMatch(AccountingEntryDiagnosticResponse::blocking);
        return new AccountingEntryReadResponse(invoice.getInvoiceId(), invoice.getInvoiceNumber(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getLegalName(),
                invoice.getCurrencyCode(), invoice.getInvoiceStatus().getCode(),
                mapper.toResponse(entry, entryLines), journal == null ? null : toJournalResponse(journal),
                exported ? AccountingEntryExportStatus.EXPORTED : AccountingEntryExportStatus.NOT_EXPORTED,
                exported ? batch.getExportBatchId() : null, exported ? batch.getGeneratedAt() : null,
                !exported && entry.getExportBatch() == null && !needsAttention, needsAttention, List.copyOf(diagnostics));
    }

    private AccountingJournalResponse toJournalResponse(AccountingJournal journal) {
        return new AccountingJournalResponse(journal.getAccountingJournalId(), journal.getCode(),
                journal.getLabel(), journal.isActive());
    }
}
