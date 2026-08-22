package org.facturation.backend.dto.response;

import java.util.List;

public class AccountingEntryPrerequisitesResponse extends ApiErrorResponse {

    private final List<String> missingPrerequisites;

    public AccountingEntryPrerequisitesResponse(String code, String message, List<String> missingPrerequisites) {
        super(code, message);
        this.missingPrerequisites = List.copyOf(missingPrerequisites);
    }

    public List<String> getMissingPrerequisites() {
        return missingPrerequisites;
    }
}
