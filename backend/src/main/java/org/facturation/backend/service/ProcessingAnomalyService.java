package org.facturation.backend.service;

import org.facturation.backend.dto.response.ProcessingAnomalyResponse;
import org.facturation.backend.model.ProcessingAnomalyCode;

import java.util.List;

public interface ProcessingAnomalyService {

    ProcessingAnomalyResponse create(Long invoiceId, ProcessingAnomalyCode code);

    List<ProcessingAnomalyResponse> getDashboardAnomalies(boolean includeResolved);

    ProcessingAnomalyResponse resolve(Long invoiceId, Long anomalyId);
}
