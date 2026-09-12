package org.facturation.backend.service;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.ProcessingAnomalyResponse;
import org.facturation.backend.model.Invoice;

import java.util.List;

public record InvoiceIngestionResult(
        Invoice invoice,
        OcrAnalysisResponse ocrAnalysis,
        List<ProcessingAnomalyResponse> warnings
) {
}
