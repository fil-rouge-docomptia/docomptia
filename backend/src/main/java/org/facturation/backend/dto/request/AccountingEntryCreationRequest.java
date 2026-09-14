package org.facturation.backend.dto.request;

import java.time.LocalDate;
import java.util.List;

public record AccountingEntryCreationRequest(Long invoiceId, LocalDate entryDate, Long journalId,
        String label, List<AccountingEntryLineCorrectionRequest> lines) { }
