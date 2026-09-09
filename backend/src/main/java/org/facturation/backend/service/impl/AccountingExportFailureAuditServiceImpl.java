package org.facturation.backend.service.impl;

import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.service.AccountingExportFailureAuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AccountingExportFailureAuditServiceImpl implements AccountingExportFailureAuditService {

    private final AuditLogRepository auditLogRepository;

    public AccountingExportFailureAuditServiceImpl(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            User user,
            LocalDate startDate,
            LocalDate endDate,
            List<Invoice> invoices,
            ExportBatchFormat format,
            RuntimeException exception
    ) {
        AuditLog auditLog = new AuditLog();
        auditLog.setOrganization(user.getOrganization());
        auditLog.setUser(user);
        auditLog.setEntityName(exportEntityName(format));
        auditLog.setEntityId(user.getUserId());
        auditLog.setAction(format.getCode() + "_EXPORT");
        auditLog.setOldValue(exportScope(startDate, endDate, invoices, format));
        auditLog.setNewValue("result=FAILURE, reason=" + exception.getMessage());
        auditLog.setCreatedAt(LocalDateTime.now());
        auditLogRepository.save(auditLog);
    }

    private String exportScope(
            LocalDate startDate,
            LocalDate endDate,
            List<Invoice> invoices,
            ExportBatchFormat format
    ) {
        return "format=" + format.getCode()
                + ", periodStartDate=" + startDate
                + ", periodEndDate=" + endDate
                + ", invoiceIds=" + invoices.stream().map(Invoice::getInvoiceId).toList();
    }

    private String exportEntityName(ExportBatchFormat format) {
        return "Accounting" + format.getCode().charAt(0)
                + format.getCode().substring(1).toLowerCase() + "Export";
    }
}
