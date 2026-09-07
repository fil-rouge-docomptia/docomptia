package org.facturation.backend.dto.response;

import java.util.List;

public record AccountImportPreview(String fingerprint, int totalRows, long newAccounts, long existingAccounts,
                                   long duplicateAccounts, long invalidRows, List<Row> rows) {
    public enum Status { NEW, EXISTING, DUPLICATE, INVALID, IMPORTED }

    public record Row(int lineNumber, String accountNumber, String accountLabel, String accountType,
                      boolean active, Status status, List<String> errors) {}
}
