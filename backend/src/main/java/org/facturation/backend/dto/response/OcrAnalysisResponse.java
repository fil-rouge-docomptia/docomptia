package org.facturation.backend.dto.response;

import java.util.ArrayList;
import java.util.List;

public class OcrAnalysisResponse {

    private String status;
    private String rawText;
    private String confidenceScore;
    private List<OcrFieldResponse> fields = new ArrayList<>();

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRawText() {
        return rawText;
    }

    public void setRawText(String rawText) {
        this.rawText = rawText;
    }

    public String getConfidenceScore() {
        return confidenceScore;
    }

    public void setConfidenceScore(String confidenceScore) {
        this.confidenceScore = confidenceScore;
    }

    public List<OcrFieldResponse> getFields() {
        return fields;
    }

    public void setFields(List<OcrFieldResponse> fields) {
        this.fields = fields;
    }
}
