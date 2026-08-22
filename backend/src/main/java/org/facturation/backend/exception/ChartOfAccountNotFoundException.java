package org.facturation.backend.exception;

public class ChartOfAccountNotFoundException extends RuntimeException {

    public ChartOfAccountNotFoundException(Long accountId) {
        super("Chart of account " + accountId + " not found");
    }
}
