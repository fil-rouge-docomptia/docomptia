package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.exception.AccountingEntryLineNotFoundException;
import org.facturation.backend.exception.AccountingEntryNotModifiableException;
import org.facturation.backend.exception.InvalidAccountingEntryLineCorrectionException;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.service.AccountingEntryCorrectionService;
import org.facturation.backend.service.AccountingEntryMutationGuard;
import org.facturation.backend.service.AccountingEntryReadService;
import org.facturation.backend.service.AccountingExportValidator;
import org.facturation.backend.repository.ClassificationRepository;
import org.facturation.backend.model.Classification;
import org.facturation.backend.service.AuditLogService;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceStatusWorkflowService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class AccountingEntryCorrectionServiceImpl implements AccountingEntryCorrectionService {

    private static final int AMOUNT_SCALE = 2;
    private static final String LINE_CORRECTION_ACTION = "LINE_CORRECTION";

    private final AccountingEntryLineRepository accountingEntryLineRepository;
    private final AuditLogService auditLogService;
    private final ChartOfAccountRepository chartOfAccountRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final CurrentUserService currentUserService;
    private final AccountingEntryMutationGuard mutationGuard;
    private final AccountingEntryReadService readService;
    private final AccountingExportValidator validator;
    private final ClassificationRepository classifications;

    public AccountingEntryCorrectionServiceImpl(
            AccountingEntryLineRepository accountingEntryLineRepository,
            AuditLogService auditLogService,
            ChartOfAccountRepository chartOfAccountRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            CurrentUserService currentUserService,
            AccountingEntryMutationGuard mutationGuard, AccountingEntryReadService readService,
            AccountingExportValidator validator, ClassificationRepository classifications
    ) {
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.auditLogService = auditLogService;
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.currentUserService = currentUserService;
        this.mutationGuard = mutationGuard;
        this.readService = readService;
        this.validator = validator;
        this.classifications = classifications;
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
        List<AppliedCorrection> corrections = applyCorrections(line, request, user.getOrganization().getOrganizationId());
        if (corrections.isEmpty()) {
            throw new InvalidAccountingEntryLineCorrectionException("At least one changed field is required");
        }
        validateLine(line, user.getOrganization().getOrganizationId());
        accountingEntryLineRepository.save(line);
        corrections.forEach(correction -> saveAuditLog(line, user, correction));
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
        if (request == null || request.getAccountId() == null || request.getLineLabel() == null
                || request.getDebitAmount() == null || request.getCreditAmount() == null) {
            throw new InvalidAccountingEntryLineCorrectionException("accountId, lineLabel, debitAmount and creditAmount are required");
        }
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(mutation.entry());
        line.setDebitAmount(BigDecimal.ZERO);
        line.setCreditAmount(BigDecimal.ZERO);
        line.setCreatedAt(LocalDateTime.now());
        int lastNumber = accountingEntryLineRepository.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(entryId)
                .stream().mapToInt(AccountingEntryLine::getLineNumber).max().orElse(0);
        line.setLineNumber(Math.incrementExact(lastNumber));
        applyCorrections(line, request, user.getOrganization().getOrganizationId());
        validateLine(line, user.getOrganization().getOrganizationId());
        accountingEntryLineRepository.saveAndFlush(line);
        auditLifecycle(line, user, "LINE_ADDED", true);
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
        auditLifecycle(line, user, "LINE_REMOVED", false);
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

    private List<AppliedCorrection> applyCorrections(
            AccountingEntryLine line,
            AccountingEntryLineCorrectionRequest request,
            Long organizationId
    ) {
        if (request == null) {
            throw new InvalidAccountingEntryLineCorrectionException("Correction request is required");
        }
        List<AppliedCorrection> corrections = new ArrayList<>();

        if (request.getAccountId() != null) {
            ChartOfAccount account = chartOfAccountRepository
                    .findByAccountIdAndOrganizationOrganizationIdAndIsActiveTrue(
                            request.getAccountId(),
                            organizationId
                    )
                    .orElseThrow(() -> new InvalidAccountingEntryLineCorrectionException(
                            "accountId must reference an active account of the organization"
                    ));
            if (line.getAccount() == null || !Objects.equals(line.getAccount().getAccountId(), account.getAccountId())) {
                corrections.add(new AppliedCorrection(
                        "accountId",
                        line.getAccount() == null ? null : line.getAccount().getAccountId().toString(),
                        account.getAccountId().toString()
                ));
                line.setAccount(account);
                if (line.getSupplierAccount() != null) {
                    corrections.add(new AppliedCorrection("supplierAccountId", line.getSupplierAccount().getSupplierAccountId().toString(), null));
                    line.setSupplierAccount(null);
                }
            }
        }

        if (request.getLineLabel() != null) {
            String lineLabel = requireLabel(request.getLineLabel());
            if (!Objects.equals(line.getLineLabel(), lineLabel)) {
                corrections.add(new AppliedCorrection("lineLabel", line.getLineLabel(), lineLabel));
                line.setLineLabel(lineLabel);
            }
        }

        applyAmountCorrection(
                corrections,
                "debitAmount",
                line.getDebitAmount(),
                request.getDebitAmount(),
                line::setDebitAmount
        );
        applyAmountCorrection(
                corrections,
                "creditAmount",
                line.getCreditAmount(),
                request.getCreditAmount(),
                line::setCreditAmount
        );
        if (request.hasVatRate()) {
            BigDecimal rate = request.getVatRate();
            if (rate != null) {
                rate = normalizeAmount(rate, "vatRate");
                if (rate.compareTo(new BigDecimal("100")) > 0) {
                    throw new InvalidAccountingEntryLineCorrectionException("vatRate must be between 0 and 100");
                }
            }
            if (!Objects.equals(line.getVatRate(), rate)) {
                corrections.add(new AppliedCorrection("vatRate", text(line.getVatRate()), text(rate)));
                line.setVatRate(rate);
            }
        }
        if (request.hasClassification()) {
            Classification classification = null;
            if (request.getClassificationId() != null) {
                classification = classifications.findByClassificationIdAndOrganizationOrganizationId(
                        request.getClassificationId(), organizationId).filter(Classification::isActive)
                        .orElseThrow(() -> new InvalidAccountingEntryLineCorrectionException(
                                "classificationId must reference an active classification of the organization"));
            }
            Long previous = line.getClassification() == null ? null : line.getClassification().getClassificationId();
            if (!Objects.equals(previous, request.getClassificationId())) {
                corrections.add(new AppliedCorrection("classificationId", text(previous), text(request.getClassificationId())));
                line.setClassification(classification);
            }
        }
        return corrections;
    }

    private void applyAmountCorrection(
            List<AppliedCorrection> corrections,
            String fieldName,
            BigDecimal currentAmount,
            BigDecimal requestedAmount,
            java.util.function.Consumer<BigDecimal> setter
    ) {
        if (requestedAmount == null) {
            return;
        }
        BigDecimal amount = normalizeAmount(requestedAmount, fieldName);
        if (currentAmount.compareTo(amount) != 0) {
            corrections.add(new AppliedCorrection(
                    fieldName,
                    currentAmount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP).toPlainString(),
                    amount.toPlainString()
            ));
            setter.accept(amount);
        }
    }

    private BigDecimal normalizeAmount(BigDecimal amount, String fieldName) {
        if (amount.signum() < 0) {
            throw new InvalidAccountingEntryLineCorrectionException(fieldName + " must be greater than or equal to 0");
        }
        if (amount.precision() - amount.scale() > 10) {
            throw new InvalidAccountingEntryLineCorrectionException(fieldName + " exceeds the supported amount");
        }
        try {
            return amount.setScale(AMOUNT_SCALE, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new InvalidAccountingEntryLineCorrectionException(fieldName + " must have at most two decimal places");
        }
    }

    private String requireLabel(String lineLabel) {
        if (lineLabel.isBlank() || lineLabel.trim().length() > 255) {
            throw new InvalidAccountingEntryLineCorrectionException("lineLabel is required");
        }
        return lineLabel.trim();
    }

    private void validateLine(AccountingEntryLine line, Long organizationId) {
        if (!line.getAccount().isActive() || !line.getAccount().getOrganization().getOrganizationId().equals(organizationId)) {
            throw new InvalidAccountingEntryLineCorrectionException("accountId must reference an active account of the organization");
        }
        requireLabel(line.getLineLabel() == null ? "" : line.getLineLabel());
        normalizeAmount(line.getDebitAmount(), "debitAmount");
        normalizeAmount(line.getCreditAmount(), "creditAmount");
        if (line.getDebitAmount().signum() > 0 && line.getCreditAmount().signum() > 0) {
            throw new InvalidAccountingEntryLineCorrectionException("A line cannot have both a positive debit and credit");
        }
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

    private void auditLifecycle(AccountingEntryLine line, User user, String action, boolean added) {
        String[][] fields = {{"accountingEntryId", text(line.getAccountingEntry().getAccountingEntryId())},
                {"lineNumber", text(line.getLineNumber())}, {"accountId", text(line.getAccount().getAccountId())},
                {"supplierAccountId", line.getSupplierAccount() == null ? null : text(line.getSupplierAccount().getSupplierAccountId())},
                {"lineLabel", line.getLineLabel()}, {"debitAmount", text(line.getDebitAmount())},
                {"creditAmount", text(line.getCreditAmount())}, {"vatRate", text(line.getVatRate())},
                {"classificationId", line.getClassification() == null ? null : text(line.getClassification().getClassificationId())}};
        for (String[] field : fields) {
            saveAuditLog(line, user, new AppliedCorrection(field[0], added ? null : field[1], added ? field[1] : null), action);
        }
    }

    private String text(Object value) { return value == null ? null : value.toString(); }

    private void saveAuditLog(AccountingEntryLine line, User user, AppliedCorrection correction) {
        saveAuditLog(line, user, correction, LINE_CORRECTION_ACTION);
    }

    private void saveAuditLog(AccountingEntryLine line, User user, AppliedCorrection correction, String action) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName(AccountingEntryLine.class.getSimpleName());
        auditLog.setEntityId(line.getAccountingEntryLineId());
        auditLog.setAction(action);
        auditLog.setOldValue(formatAuditValue(correction.fieldName(), correction.oldValue()));
        auditLog.setNewValue(formatAuditValue(correction.fieldName(), correction.newValue()));
        auditLog.setCreatedAt(LocalDateTime.now());
        auditLogService.save(auditLog);
    }

    private String formatAuditValue(String fieldName, String value) {
        return fieldName + "=" + (value == null ? "null" : value);
    }

    private record AppliedCorrection(String fieldName, String oldValue, String newValue) {
    }
}
