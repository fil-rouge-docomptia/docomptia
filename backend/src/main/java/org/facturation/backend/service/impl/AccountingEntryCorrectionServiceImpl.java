package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.exception.AccountingEntryLineNotFoundException;
import org.facturation.backend.exception.AccountingEntryNotModifiableException;
import org.facturation.backend.exception.InvalidAccountingEntryLineCorrectionException;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.service.AccountingEntryCorrectionService;
import org.facturation.backend.service.AccountingEntryMutationGuard;
import org.facturation.backend.service.AccountingEntryLineEditor;
import org.facturation.backend.service.AccountingEntryLineEditor.AppliedCorrection;
import org.facturation.backend.service.AccountingEntryLineAuditService;
import org.facturation.backend.service.AccountingEntryReadService;
import org.facturation.backend.service.AccountingExportValidator;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AccountingEntryCorrectionServiceImpl implements AccountingEntryCorrectionService {

    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final CurrentUserService currentUserService;
    private final AccountingEntryMutationGuard mutationGuard;
    private final AccountingEntryReadService readService;
    private final AccountingExportValidator validator;
    private final AccountingEntryLineEditor lineEditor;
    private final AccountingEntryLineAuditService lineAudit;

    public AccountingEntryCorrectionServiceImpl(
            AccountingEntryLineRepository accountingEntryLineRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            CurrentUserService currentUserService,
            AccountingEntryMutationGuard mutationGuard, AccountingEntryReadService readService,
            AccountingExportValidator validator, AccountingEntryLineEditor lineEditor, AccountingEntryLineAuditService lineAudit
    ) {
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.currentUserService = currentUserService;
        this.mutationGuard = mutationGuard;
        this.readService = readService;
        this.validator = validator;
        this.lineEditor = lineEditor;
        this.lineAudit = lineAudit;
    }

    @Override
    @Transactional
    public AccountingEntryResponse correctLine(Long entryId, Long lineId,
            AccountingEntryLineCorrectionRequest request, String ifMatch, String key) {
        User user = currentUserService.getCurrentUser();
        var mutation = mutationGuard.begin(user, entryId, lineId, "PATCH", request, ifMatch, key);
        if (mutation.replay()) return response(entryId);
        AccountingEntry entry = mutation.entry();
        ensureModifiable(entry);
        AccountingEntryLine line = findLine(entryId, lineId, user);
        List<AppliedCorrection> corrections = lineEditor.applyCorrections(line, request, user.getOrganization().getOrganizationId());
        if (corrections.isEmpty()) {
            throw new InvalidAccountingEntryLineCorrectionException("At least one changed field is required");
        }
        lineEditor.validateLine(line, user.getOrganization().getOrganizationId());
        accountingEntryLineRepository.save(line);
        corrections.forEach(correction -> lineAudit.saveAuditLog(line, user, correction));
        finish(mutation, user);
        return response(entryId);
    }

    @Override
    @Transactional
    public AccountingEntryResponse addLine(Long entryId, AccountingEntryLineCorrectionRequest request,
            String ifMatch, String key) {
        User user = currentUserService.getCurrentUser();
        var mutation = mutationGuard.begin(user, entryId, null, "POST", request, ifMatch, key);
        if (mutation.replay()) return response(entryId);
        ensureModifiable(mutation.entry());
        int lastNumber = accountingEntryLineRepository.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .stream().mapToInt(AccountingEntryLine::getLineNumber).max().orElse(0);
        AccountingEntryLine line = lineEditor.createLine(mutation.entry(), Math.incrementExact(lastNumber),
                request, user.getOrganization().getOrganizationId());
        accountingEntryLineRepository.saveAndFlush(line);
        lineAudit.auditLifecycle(line, user, "LINE_ADDED", true);
        finish(mutation, user);
        return response(entryId);
    }

    @Override
    @Transactional
    public AccountingEntryResponse removeLine(Long entryId, Long lineId, String ifMatch, String key) {
        User user = currentUserService.getCurrentUser();
        var mutation = mutationGuard.begin(user, entryId, lineId, "DELETE", null, ifMatch, key);
        if (mutation.replay()) return response(entryId);
        ensureModifiable(mutation.entry());
        AccountingEntryLine line = findLine(entryId, lineId, user);
        lineAudit.auditLifecycle(line, user, "LINE_REMOVED", false);
        accountingEntryLineRepository.delete(line);
        accountingEntryLineRepository.flush();
        finish(mutation, user);
        return response(entryId);
    }

    private AccountingEntryLine findLine(Long entryId, Long lineId, User user) {
        return accountingEntryLineRepository
                .findByAccountingEntryLineIdAndAccountingEntryAccountingEntryIdAndAccountingEntryInvoiceOrganizationOrganizationId(
                        lineId, entryId, user.getOrganization().getOrganizationId())
                .orElseThrow(() -> new AccountingEntryLineNotFoundException(entryId, lineId));
    }

    private void finish(AccountingEntryMutationGuard.Mutation mutation, User user) {
        AccountingEntry entry = mutation.entry();
        entry.setUpdatedAt(LocalDateTime.now());
        List<AccountingEntryLine> lines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entry.getAccountingEntryId());
        boolean valid = validator.inspectEntry(entry, lines).stream().noneMatch(diagnostic -> diagnostic.blocking());
        InvoiceStatusCode status = InvoiceStatusCode.fromCode(entry.getInvoice().getInvoiceStatus().getCode());
        // Corrective entries must never move the exported original invoice back into the export queue.
        if (AccountingEntryStatusCode.GENERATED.getCode().equals(entry.getStatus())) {
            if (!valid && status == InvoiceStatusCode.EXPORTABLE) {
                invoiceStatusWorkflowService.markAccountingEntryToCorrect(entry.getInvoice(), user);
            } else if (valid && status == InvoiceStatusCode.VALIDEE) {
                invoiceStatusWorkflowService.markExportable(entry.getInvoice(), user);
            }
        }
        mutationGuard.complete(mutation);
    }

    private AccountingEntryResponse response(Long entryId) {
        var read = readService.findDetails(entryId);
        var response = read.entry();
        response.setDiagnostics(read.diagnostics());
        response.setNeedsAttention(read.needsAttention());
        response.setExportEligible(read.exportEligible());
        return response;
    }

    private void ensureModifiable(AccountingEntry entry) {
        invoiceStatusWorkflowService.ensureModifiable(entry.getInvoice());
        InvoiceStatusCode invoiceStatus = InvoiceStatusCode.fromCode(entry.getInvoice().getInvoiceStatus().getCode());
        boolean generated = AccountingEntryStatusCode.GENERATED.getCode().equals(entry.getStatus());
        boolean corrective = AccountingEntryStatusCode.CORRECTIVE.getCode().equals(entry.getStatus());
        if (entry.getExportBatch() != null || (!generated && !corrective)
                || generated && (entry.getInvoice().getExportBatch() != null
                    || invoiceStatus == InvoiceStatusCode.EXPORTEE || invoiceStatus == InvoiceStatusCode.PAYEE)) {
            throw new AccountingEntryNotModifiableException(entry.getAccountingEntryId());
        }
    }

}
