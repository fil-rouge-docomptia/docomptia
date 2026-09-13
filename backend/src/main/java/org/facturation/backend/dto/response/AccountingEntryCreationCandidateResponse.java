package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record AccountingEntryCreationCandidateResponse(Long invoiceId, String invoiceNumber,
        String supplierName, String currencyCode, LocalDate invoiceDate) { }
