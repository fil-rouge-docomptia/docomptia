package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.dto.response.AccountingEntryResponse;
import org.facturation.backend.exception.AccountingEntryLineNotFoundException;
import org.facturation.backend.exception.AccountingEntryNotModifiableException;
import org.facturation.backend.exception.InvalidAccountingEntryLineCorrectionException;
import org.facturation.backend.mapper.AccountingEntryMapper;
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
    private final AccountingEntryMapper accountingEntryMapper;
    private final AuditLogService auditLogService;
    private final ChartOfAccountRepository chartOfAccountRepository;
    private final InvoiceStatusWorkflowService invoiceStatusWorkflowService;
    private final CurrentUserService currentUserService;

    public AccountingEntryCorrectionServiceImpl(
            AccountingEntryLineRepository accountingEntryLineRepository,
            AccountingEntryMapper accountingEntryMapper,
            AuditLogService auditLogService,
            ChartOfAccountRepository chartOfAccountRepository,
            InvoiceStatusWorkflowService invoiceStatusWorkflowService,
            CurrentUserService currentUserService
    ) {
        this.accountingEntryLineRepository = accountingEntryLineRepository;
        this.accountingEntryMapper = accountingEntryMapper;
        this.auditLogService = auditLogService;
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.invoiceStatusWorkflowService = invoiceStatusWorkflowService;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public AccountingEntryResponse correctLine(
            Long accountingEntryId,
            Long accountingEntryLineId,
            AccountingEntryLineCorrectionRequest request
    ) {
        User user = currentUserService.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        AccountingEntryLine line = accountingEntryLineRepository
                .findByAccountingEntryLineIdAndAccountingEntryAccountingEntryIdAndAccountingEntryInvoiceOrganizationOrganizationId(
                        accountingEntryLineId,
                        accountingEntryId,
                        organizationId
                )
                .orElseThrow(() -> new AccountingEntryLineNotFoundException(
                        accountingEntryId,
                        accountingEntryLineId
                ));
        AccountingEntry accountingEntry = line.getAccountingEntry();
        invoiceStatusWorkflowService.ensureModifiable(accountingEntry.getInvoice());
        ensureModifiable(accountingEntry);

        List<AppliedCorrection> corrections = applyCorrections(line, request, organizationId);
        if (corrections.isEmpty()) {
            throw new InvalidAccountingEntryLineCorrectionException("At least one changed field is required");
        }

        accountingEntry.setUpdatedAt(LocalDateTime.now());
        accountingEntryLineRepository.save(line);
        corrections.forEach(correction -> saveAuditLog(line, user, correction));

        List<AccountingEntryLine> lines = accountingEntryLineRepository
                .findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(accountingEntryId);
        AccountingEntryResponse response = accountingEntryMapper.toResponse(accountingEntry, lines);
        updateInvoiceExportability(accountingEntry, user, response.isBalanced());
        return response;
    }

    private void updateInvoiceExportability(AccountingEntry accountingEntry, User user, boolean balanced) {
        InvoiceStatusCode invoiceStatus = InvoiceStatusCode.fromCode(
                accountingEntry.getInvoice().getInvoiceStatus().getCode()
        );
        if (!balanced && invoiceStatus == InvoiceStatusCode.EXPORTABLE) {
            invoiceStatusWorkflowService.markAccountingEntryToCorrect(accountingEntry.getInvoice(), user);
        } else if (balanced && invoiceStatus == InvoiceStatusCode.VALIDEE) {
            invoiceStatusWorkflowService.markExportable(accountingEntry.getInvoice(), user);
        }
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
            if (!Objects.equals(line.getAccount().getAccountId(), account.getAccountId())) {
                corrections.add(new AppliedCorrection(
                        "accountId",
                        line.getAccount().getAccountId().toString(),
                        account.getAccountId().toString()
                ));
                line.setAccount(account);
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
        return amount.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
    }

    private String requireLabel(String lineLabel) {
        if (lineLabel.isBlank()) {
            throw new InvalidAccountingEntryLineCorrectionException("lineLabel is required");
        }
        return lineLabel.trim();
    }

    private void ensureModifiable(AccountingEntry accountingEntry) {
        InvoiceStatusCode invoiceStatus = InvoiceStatusCode.fromCode(
                accountingEntry.getInvoice().getInvoiceStatus().getCode()
        );
        if (!AccountingEntryStatusCode.GENERATED.getCode().equals(accountingEntry.getStatus())
                || invoiceStatus == InvoiceStatusCode.EXPORTEE
                || invoiceStatus == InvoiceStatusCode.ARCHIVEE) {
            throw new AccountingEntryNotModifiableException(accountingEntry.getAccountingEntryId());
        }
    }

    private void saveAuditLog(AccountingEntryLine line, User user, AppliedCorrection correction) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName(AccountingEntryLine.class.getSimpleName());
        auditLog.setEntityId(line.getAccountingEntryLineId());
        auditLog.setAction(LINE_CORRECTION_ACTION);
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
