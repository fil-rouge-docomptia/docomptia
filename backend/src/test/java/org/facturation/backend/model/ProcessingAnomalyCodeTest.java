package org.facturation.backend.model;

import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ProcessingAnomalyCodeTest {

    @Test
    void definesTheStableBusinessAnomalyCatalog() {
        Set<String> expectedCodes = Set.of(
                "OCR_INCOMPLETE",
                "INVALID_VAT",
                "INCONSISTENT_AMOUNTS",
                "SUSPECTED_DUPLICATE",
                "MISSING_THIRD_PARTY_ACCOUNT",
                "UNBALANCED_ACCOUNTING_ENTRY",
                "EXPORT_ERROR"
        );

        Set<String> actualCodes = Stream.of(ProcessingAnomalyCode.values())
                .peek(anomaly -> {
                    assertFalse(anomaly.getLabel().isBlank());
                    assertFalse(anomaly.getDescription().isBlank());
                    assertEquals(anomaly, ProcessingAnomalyCode.fromCode(anomaly.getCode()));
                })
                .map(ProcessingAnomalyCode::getCode)
                .collect(Collectors.toSet());

        assertEquals(expectedCodes, actualCodes);
    }
}
