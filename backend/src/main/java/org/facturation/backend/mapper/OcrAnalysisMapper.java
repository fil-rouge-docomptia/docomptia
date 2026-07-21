package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.facturation.backend.model.OcrExtraction;
import org.facturation.backend.model.OcrExtractionField;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OcrAnalysisMapper {

    public OcrAnalysisResponse toResponse(OcrExtraction ocrExtraction, List<OcrExtractionField> fields) {
        OcrAnalysisResponse response = new OcrAnalysisResponse();
        response.setStatus(ocrExtraction.getStatus());
        response.setRawText(ocrExtraction.getRawText());
        response.setConfidenceScore(ocrExtraction.getConfidenceScore() == null ? null : ocrExtraction.getConfidenceScore().toString());
        response.setFields(fields.stream().map(this::toFieldResponse).toList());
        return response;
    }

    private OcrFieldResponse toFieldResponse(OcrExtractionField field) {
        OcrFieldResponse response = new OcrFieldResponse();
        response.setFieldName(field.getFieldName());
        response.setRawValue(field.getRawValue());
        response.setNormalizedValue(field.getNormalizedValue());
        response.setConfidenceScore(field.getConfidenceScore() == null ? null : field.getConfidenceScore().toString());
        return response;
    }
}
