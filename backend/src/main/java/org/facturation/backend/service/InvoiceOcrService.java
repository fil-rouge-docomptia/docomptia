package org.facturation.backend.service;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrExtraction;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

public interface InvoiceOcrService {

    OcrAnalysisResponse analyze(MultipartFile file);

    OcrExtraction saveExtraction(Invoice invoice, OcrAnalysisResponse ocrAnalysis);

    Optional<OcrAnalysisResponse> findLatestAnalysisResponse(Long invoiceId);

    Optional<String> extractOptionalNormalizedValue(OcrAnalysisResponse response, String fieldName);

    Optional<LocalDate> extractDate(OcrAnalysisResponse response, String fieldName);

    Optional<BigDecimal> extractOptionalAmount(OcrAnalysisResponse response, String fieldName);
}
