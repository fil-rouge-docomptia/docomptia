package org.facturation.backend.dto.response;

import java.math.BigDecimal;

public record ValidationPreferencesResponse(
        boolean validationRequired,
        BigDecimal validationThreshold
) {
}
