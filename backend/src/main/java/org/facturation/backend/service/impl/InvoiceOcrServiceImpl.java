package org.facturation.backend.service.impl;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.mapper.OcrAnalysisMapper;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.model.OcrExtractionField;
import org.facturation.backend.repository.OcrExtractionFieldRepository;
import org.facturation.backend.repository.OcrExtractionRepository;
import org.facturation.backend.service.InvoiceOcrService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;

@Service
public class InvoiceOcrServiceImpl implements InvoiceOcrService {

    private static final BigDecimal MAX_PERSISTED_AMOUNT = new BigDecimal("9999999999.99");
    private static final int AMOUNT_SCALE = 2;
    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("d-M-yyyy"),
            DateTimeFormatter.ISO_LOCAL_DATE
    );

    private final OcrClient ocrClient;
    private final OcrExtractionRepository ocrExtractionRepository;
    private final OcrExtractionFieldRepository ocrExtractionFieldRepository;
    private final OcrAnalysisMapper ocrAnalysisMapper;

    public InvoiceOcrServiceImpl(
            OcrClient ocrClient,
            OcrExtractionRepository ocrExtractionRepository,
            OcrExtractionFieldRepository ocrExtractionFieldRepository,
            OcrAnalysisMapper ocrAnalysisMapper
    ) {
        this.ocrClient = ocrClient;
        this.ocrExtractionRepository = ocrExtractionRepository;
        this.ocrExtractionFieldRepository = ocrExtractionFieldRepository;
        this.ocrAnalysisMapper = ocrAnalysisMapper;
    }

    @Override
    public OcrAnalysisResponse analyze(MultipartFile file) {
        return ocrClient.analyze(file);
    }

    @Override
    public OcrExtraction saveExtraction(Invoice invoice, OcrAnalysisResponse ocrAnalysis) {
        OcrExtraction ocrExtraction = saveOcrExtraction(invoice, ocrAnalysis);
        saveOcrExtractionFields(ocrExtraction, ocrAnalysis);
        return ocrExtraction;
    }

    @Override
    public Optional<OcrAnalysisResponse> findLatestAnalysisResponse(Long invoiceId) {
        return ocrExtractionRepository.findTopByInvoiceInvoiceIdOrderByOcrExtractionIdDesc(invoiceId)
                .map(ocrExtraction -> ocrAnalysisMapper.toResponse(
                        ocrExtraction,
                        ocrExtractionFieldRepository.findByOcrExtractionOcrExtractionId(ocrExtraction.getOcrExtractionId())
                ));
    }

    @Override
    public String extractNormalizedValue(OcrAnalysisResponse response, String fieldName, String fallback) {
        return extractOptionalNormalizedValue(response, fieldName).orElse(fallback);
    }

    @Override
    public Optional<String> extractOptionalNormalizedValue(OcrAnalysisResponse response, String fieldName) {
        return response.getFields().stream()
                .filter(field -> fieldName.equals(field.getFieldName()))
                .map(OcrFieldResponse::getNormalizedValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }

    @Override
    public Optional<LocalDate> extractDate(OcrAnalysisResponse response, String fieldName) {
        return extractOptionalNormalizedValue(response, fieldName).flatMap(this::toLocalDate);
    }

    @Override
    public BigDecimal extractAmount(OcrAnalysisResponse response, String fieldName) {
        return toPersistableAmount(extractNormalizedValue(response, fieldName, "0.00"));
    }

    private OcrExtraction saveOcrExtraction(Invoice invoice, OcrAnalysisResponse ocrAnalysis) {
        OcrExtraction ocrExtraction = new OcrExtraction();
        ocrExtraction.setInvoice(invoice);
        ocrExtraction.setStatus(ocrAnalysis.getStatus());
        ocrExtraction.setEngineName("mock-ocr");
        ocrExtraction.setEngineVersion("1.0");
        ocrExtraction.setRawText(ocrAnalysis.getRawText());
        ocrExtraction.setConfidenceScore(toBigDecimal(ocrAnalysis.getConfidenceScore()));
        ocrExtraction.setProcessedAt(LocalDateTime.now());
        ocrExtraction.setCreatedAt(LocalDateTime.now());
        return ocrExtractionRepository.save(ocrExtraction);
    }

    private void saveOcrExtractionFields(OcrExtraction ocrExtraction, OcrAnalysisResponse ocrAnalysis) {
        for (OcrFieldResponse field : ocrAnalysis.getFields()) {
            ocrExtractionFieldRepository.save(createOcrExtractionField(ocrExtraction, field));
        }
    }

    private OcrExtractionField createOcrExtractionField(OcrExtraction ocrExtraction, OcrFieldResponse field) {
        OcrExtractionField extractionField = new OcrExtractionField();
        extractionField.setOcrExtraction(ocrExtraction);
        extractionField.setFieldName(field.getFieldName());
        extractionField.setRawValue(field.getRawValue());
        extractionField.setNormalizedValue(field.getNormalizedValue());
        extractionField.setConfidenceScore(toBigDecimal(field.getConfidenceScore()));
        extractionField.setCorrected(false);
        extractionField.setCreatedAt(LocalDateTime.now());
        extractionField.setUpdatedAt(LocalDateTime.now());
        return extractionField;
    }

    private Optional<LocalDate> toLocalDate(String value) {
        for (DateTimeFormatter formatter : DATE_FORMATTERS) {
            try {
                return Optional.of(LocalDate.parse(value, formatter));
            } catch (DateTimeParseException ignored) {
                // Try the next supported OCR date format.
            }
        }
        return Optional.empty();
    }

    private BigDecimal toBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal toPersistableAmount(String value) {
        BigDecimal amount = toBigDecimal(value).setScale(AMOUNT_SCALE, RoundingMode.HALF_UP);
        if (amount.abs().compareTo(MAX_PERSISTED_AMOUNT) > 0) {
            return BigDecimal.ZERO.setScale(AMOUNT_SCALE);
        }
        return amount;
    }
}
