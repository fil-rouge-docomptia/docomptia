package org.facturation.backend.client;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.dto.response.OcrFieldResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Component
@ConditionalOnProperty(name = "app.ocr.mock", havingValue = "true", matchIfMissing = true)
public class MockOcrClient implements OcrClient {

    @Override
    public OcrAnalysisResponse analyze(MultipartFile file) {
        OcrFieldResponse supplierField = new OcrFieldResponse();
        supplierField.setFieldName("supplierName");
        supplierField.setRawValue("Orange");
        supplierField.setNormalizedValue("Orange SA");
        supplierField.setConfidenceScore("0.95");

        OcrFieldResponse siretField = new OcrFieldResponse();
        siretField.setFieldName("siret");
        siretField.setRawValue("380 129 866 00014");
        siretField.setNormalizedValue("38012986600014");
        siretField.setConfidenceScore("0.98");

        OcrFieldResponse invoiceNumberField = new OcrFieldResponse();
        invoiceNumberField.setFieldName("invoiceNumber");
        invoiceNumberField.setRawValue("INV-" + System.currentTimeMillis());
        invoiceNumberField.setNormalizedValue(invoiceNumberField.getRawValue());
        invoiceNumberField.setConfidenceScore("0.93");

        OcrFieldResponse totalHtField = new OcrFieldResponse();
        totalHtField.setFieldName("totalHt");
        totalHtField.setRawValue("100.00");
        totalHtField.setNormalizedValue("100.00");
        totalHtField.setConfidenceScore("0.90");

        OcrFieldResponse totalTvaField = new OcrFieldResponse();
        totalTvaField.setFieldName("totalTva");
        totalTvaField.setRawValue("20.00");
        totalTvaField.setNormalizedValue("20.00");
        totalTvaField.setConfidenceScore("0.90");

        OcrFieldResponse totalTtcField = new OcrFieldResponse();
        totalTtcField.setFieldName("totalTtc");
        totalTtcField.setRawValue("120.00");
        totalTtcField.setNormalizedValue("120.00");
        totalTtcField.setConfidenceScore("0.92");

        OcrAnalysisResponse response = new OcrAnalysisResponse();
        response.setStatus("SUCCESS");
        response.setEngineName("mock-ocr");
        response.setEngineVersion("1.0");
        response.setRawText("Mock OCR result for file " + file.getOriginalFilename());
        response.setConfidenceScore("0.92");
        response.setFields(List.of(
                supplierField,
                siretField,
                invoiceNumberField,
                totalHtField,
                totalTvaField,
                totalTtcField
        ));
        return response;
    }
}
