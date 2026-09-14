package org.facturation.backend.service.impl;

import jakarta.persistence.EntityManager;
import org.facturation.backend.dto.request.AccountingEntryCreationRequest;
import org.facturation.backend.dto.response.AccountingEntryCreationCandidateResponse;
import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.facturation.backend.exception.AccountingEntryAlreadyExistsException;
import org.facturation.backend.exception.AccountingEntryCreationNotAllowedException;
import org.facturation.backend.exception.InvalidAccountingEntryLineCorrectionException;
import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.model.*;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AccountingJournalRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class AccountingEntryManualCreationServiceImpl implements AccountingEntryManualCreationService {
    private final InvoiceRepository invoices;
    private final AccountingEntryRepository entries;
    private final AccountingEntryLineRepository lines;
    private final AccountingJournalRepository journals;
    private final CurrentUserService currentUser;
    private final AccountingPieceNumberService numbering;
    private final InvoiceStatusWorkflowService workflow;
    private final InvoiceDuplicateAlertService duplicates;
    private final AccountingEntryLineEditor lineEditor;
    private final AccountingEntryLineAuditService lineAudit;
    private final AccountingExportValidator validator;
    private final AccountingEntryReadService readService;
    private final AuditLogService audit;
    private final EntityManager entityManager;

    public AccountingEntryManualCreationServiceImpl(InvoiceRepository invoices, AccountingEntryRepository entries,
            AccountingEntryLineRepository lines, AccountingJournalRepository journals, CurrentUserService currentUser,
            AccountingPieceNumberService numbering, InvoiceStatusWorkflowService workflow, InvoiceDuplicateAlertService duplicates,
            AccountingEntryLineEditor lineEditor, AccountingEntryLineAuditService lineAudit, AccountingExportValidator validator,
            AccountingEntryReadService readService, AuditLogService audit, EntityManager entityManager) {
        this.invoices = invoices;
        this.entries = entries;
        this.lines = lines;
        this.journals = journals;
        this.currentUser = currentUser;
        this.numbering = numbering;
        this.workflow = workflow;
        this.duplicates = duplicates;
        this.lineEditor = lineEditor;
        this.lineAudit = lineAudit;
        this.validator = validator;
        this.readService = readService;
        this.audit = audit;
        this.entityManager = entityManager;
    }

    @Override
    public Page<AccountingEntryCreationCandidateResponse> findCandidates(String query, Pageable pageable) {
        return invoices.findManualAccountingCandidates(currentUser.getCurrentUser().getOrganization().getOrganizationId(),
                query.trim().toLowerCase(Locale.ROOT), pageable).map(invoice -> new AccountingEntryCreationCandidateResponse(
                        invoice.getInvoiceId(), invoice.getInvoiceNumber(), invoice.getSupplier().getLegalName(),
                        invoice.getCurrencyCode(), invoice.getInvoiceDate()));
    }

    @Override
    @Transactional
    public AccountingEntryReadResponse create(AccountingEntryCreationRequest request) {
        validateHeader(request);
        User user = currentUser.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        // Keep the organization -> invoice lock order used by export and share the automatic generation lock.
        numbering.lockSequence(organizationId);
        Invoice invoice = invoices.findForAccountingGenerationByInvoiceIdAndOrganizationOrganizationId(request.invoiceId(), organizationId)
                .orElseThrow(() -> new InvoiceNotFoundException(request.invoiceId()));
        entityManager.refresh(invoice);
        entries.findByInvoiceInvoiceIdAndReversedAccountingEntryIsNull(invoice.getInvoiceId())
                .ifPresent(existing -> { throw new AccountingEntryAlreadyExistsException(existing.getAccountingEntryId()); });
        ensureEligible(invoice, organizationId);
        duplicates.ensureNoPendingAlerts(invoice.getInvoiceId(), "create a manual accounting entry");
        AccountingJournal journal = journals.findByAccountingJournalIdAndOrganizationOrganizationIdAndActiveTrue(
                request.journalId(), organizationId).orElseThrow(() -> new InvalidAccountingEntryLineCorrectionException(
                        "journalId must reference an active journal of the organization"));

        AccountingEntry entry = prepareEntry(request, invoice, journal, user);
        List<AccountingEntryLine> preparedLines = new ArrayList<>();
        for (int index = 0; index < request.lines().size(); index++) {
            preparedLines.add(lineEditor.createLine(entry, index + 1, request.lines().get(index), organizationId));
        }
        entries.save(entry);
        lines.saveAll(preparedLines);
        recordCreation(entry, preparedLines, user);
        if (validator.inspectEntry(entry, preparedLines).stream().noneMatch(diagnostic -> diagnostic.blocking())) {
            workflow.markExportable(invoice, user);
        }
        entityManager.flush();
        return readService.findDetails(entry.getAccountingEntryId());
    }

    private void validateHeader(AccountingEntryCreationRequest request) {
        if (request == null || request.invoiceId() == null || request.invoiceId() <= 0
                || request.journalId() == null || request.journalId() <= 0 || request.entryDate() == null
                || request.entryDate().getYear() < 1 || request.entryDate().getYear() > 9999
                || request.label() == null || request.label().isBlank() || request.label().trim().length() > 255
                || request.lines() == null || request.lines().isEmpty()) {
            throw new InvalidAccountingEntryLineCorrectionException(
                    "A positive invoiceId and journalId, an ISO date (years 0001-9999), a label (1-255 characters) and non-empty lines are required");
        }
    }

    private void ensureEligible(Invoice invoice, Long organizationId) {
        workflow.ensureModifiable(invoice);
        if (!InvoiceStatusCode.VALIDEE.getCode().equals(invoice.getInvoiceStatus().getCode())
                || invoice.getExportBatch() != null || invoice.getClient() != null || invoice.getSupplier() == null
                || !organizationId.equals(invoice.getSupplier().getOrganization().getOrganizationId())) {
            throw new AccountingEntryCreationNotAllowedException("A validated supplier invoice without an export batch is required");
        }
    }

    private AccountingEntry prepareEntry(AccountingEntryCreationRequest request, Invoice invoice, AccountingJournal journal, User user) {
        AccountingEntry entry = new AccountingEntry();
        entry.setInvoice(invoice);
        entry.setJournal(journal);
        entry.setEntryDate(request.entryDate());
        entry.setEntryNumber("EC-" + invoice.getInvoiceId());
        entry.setLabel(request.label().trim());
        entry.setStatus(AccountingEntryStatusCode.GENERATED.getCode());
        entry.setCreatedByUser(user);
        entry.setCreatedAt(LocalDateTime.now());
        entry.setUpdatedAt(entry.getCreatedAt());
        return entry;
    }

    private void recordCreation(AccountingEntry entry, List<AccountingEntryLine> entryLines, User user) {
        // The invoice event makes even an unbalanced proposal visible in its existing activity history.
        saveCreationAudit(user, Invoice.class.getSimpleName(), entry.getInvoice().getInvoiceId(),
                "accountingEntryId=" + entry.getAccountingEntryId());
        for (String value : List.of("invoiceId=" + entry.getInvoice().getInvoiceId(), "entryNumber=" + entry.getEntryNumber(),
                "entryDate=" + entry.getEntryDate(), "journalId=" + entry.getJournal().getAccountingJournalId(),
                "label=" + entry.getLabel(), "status=" + entry.getStatus())) {
            saveCreationAudit(user, AccountingEntry.class.getSimpleName(), entry.getAccountingEntryId(), value);
        }
        entryLines.forEach(line -> lineAudit.auditLifecycle(line, user, "LINE_ADDED", true));
    }

    private void saveCreationAudit(User user, String entityName, Long entityId, String value) {
        AuditLog log = new AuditLog();
        log.setOrganization(user.getOrganization());
        log.setUser(user);
        log.setEntityName(entityName);
        log.setEntityId(entityId);
        log.setAction("ACCOUNTING_ENTRY_CREATED");
        log.setNewValue(value);
        log.setCreatedAt(LocalDateTime.now());
        audit.save(log);
    }
}
