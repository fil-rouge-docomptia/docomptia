package org.facturation.backend.service;

import org.facturation.backend.dto.response.DashboardSummaryResponse;

import java.time.LocalDate;

public interface DashboardService {

    DashboardSummaryResponse getSummary(LocalDate startDate, LocalDate endDate, int actionLimit);
}
