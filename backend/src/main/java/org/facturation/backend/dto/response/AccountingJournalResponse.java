package org.facturation.backend.dto.response;

public record AccountingJournalResponse(Long accountingJournalId, String code, String label, boolean active) {
}
