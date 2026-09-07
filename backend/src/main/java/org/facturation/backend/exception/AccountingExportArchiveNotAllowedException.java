package org.facturation.backend.exception;

public class AccountingExportArchiveNotAllowedException extends RuntimeException {

    public AccountingExportArchiveNotAllowedException(Long exportBatchId, String status) {
        super("Accounting export batch " + exportBatchId + " cannot be archived from status " + status);
    }
}
