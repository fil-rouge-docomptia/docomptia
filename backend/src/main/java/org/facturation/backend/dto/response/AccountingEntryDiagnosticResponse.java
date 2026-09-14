package org.facturation.backend.dto.response;

public record AccountingEntryDiagnosticResponse(
        String code, String message, boolean blocking, Long accountingEntryLineId) {
}
