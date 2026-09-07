package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.User;

import java.time.LocalDate;
import java.util.List;

public interface AccountingExportFailureAuditService {

    void record(
            User user,
            LocalDate startDate,
            LocalDate endDate,
            List<Invoice> invoices,
            ExportBatchFormat format,
            RuntimeException exception
    );
}
