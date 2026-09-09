package org.facturation.backend.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record AccountImportResult(int imported, long existingAccounts, long duplicateAccounts, long invalidRows,
                                  Long importedByUserId, LocalDateTime importedAt,
                                  List<AccountImportPreview.Row> rows) {}
