package org.facturation.backend.exception;

import java.util.List;

public class AccountingEntryPrerequisitesException extends IllegalStateException {

    private final List<String> missingPrerequisites;

    public AccountingEntryPrerequisitesException(Long invoiceId, List<String> missingPrerequisites) {
        super(
                "Cannot generate accounting entry for invoice " + invoiceId
                        + "; missing or invalid prerequisites: " + String.join(", ", missingPrerequisites)
        );
        this.missingPrerequisites = List.copyOf(missingPrerequisites);
    }

    public List<String> getMissingPrerequisites() {
        return missingPrerequisites;
    }
}
