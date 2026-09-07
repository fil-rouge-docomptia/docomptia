package org.facturation.backend.exception;

public class AccountingExportFileNotFoundException extends RuntimeException {

    public AccountingExportFileNotFoundException(Long exportBatchId) {
        super("File for accounting export batch " + exportBatchId + " not found");
    }
}
