package org.facturation.backend.service;

import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.User;
import org.facturation.backend.service.AccountingEntryLineEditor.AppliedCorrection;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
public class AccountingEntryLineAuditService {
    private static final String LINE_CORRECTION_ACTION = "LINE_CORRECTION";
    private final AuditLogService auditLogService;

    public AccountingEntryLineAuditService(AuditLogService auditLogService) { this.auditLogService = auditLogService; }

    public void auditLifecycle(AccountingEntryLine line, User user, String action, boolean added) {
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

    public void saveAuditLog(AccountingEntryLine line, User user, AppliedCorrection correction) {
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

}
