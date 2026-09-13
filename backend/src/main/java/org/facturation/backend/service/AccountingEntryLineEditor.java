package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.exception.InvalidAccountingEntryLineCorrectionException;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Classification;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.ClassificationRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class AccountingEntryLineEditor {
    private static final int AMOUNT_SCALE = 2;
    private final ChartOfAccountRepository chartOfAccountRepository;
    private final ClassificationRepository classifications;

    public AccountingEntryLineEditor(ChartOfAccountRepository chartOfAccountRepository, ClassificationRepository classifications) {
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.classifications = classifications;
    }

    public AccountingEntryLine createLine(AccountingEntry entry, int number,
            AccountingEntryLineCorrectionRequest request, Long organizationId) {
        if (request == null || request.getAccountId() == null || request.getLineLabel() == null
                || request.getDebitAmount() == null || request.getCreditAmount() == null) {
            throw new InvalidAccountingEntryLineCorrectionException("accountId, lineLabel, debitAmount and creditAmount are required");
        }
        AccountingEntryLine line = new AccountingEntryLine();
        line.setAccountingEntry(entry);
        line.setDebitAmount(BigDecimal.ZERO);
        line.setCreditAmount(BigDecimal.ZERO);
        line.setCreatedAt(LocalDateTime.now());
        line.setLineNumber(number);
        applyCorrections(line, request, organizationId);
        validateLine(line, organizationId);
        return line;
    }

    public List<AppliedCorrection> applyCorrections(
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

    public void validateLine(AccountingEntryLine line, Long organizationId) {
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

    private String text(Object value) { return value == null ? null : value.toString(); }

    public record AppliedCorrection(String fieldName, String oldValue, String newValue) { }
}
