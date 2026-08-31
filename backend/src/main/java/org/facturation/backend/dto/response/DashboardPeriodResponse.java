package org.facturation.backend.dto.response;

import java.time.LocalDate;

public record DashboardPeriodResponse(LocalDate startDate, LocalDate endDate) {
}
