package org.facturation.backend.client;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Component
@ConditionalOnProperty(name = "app.ocr.mock", havingValue = "false")
public class FastApiOcrClient implements OcrClient {

    private final RestClient restClient;

    public FastApiOcrClient(@Value("${app.ocr.base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    @Override
    public OcrAnalysisResponse analyze(MultipartFile file) {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", toResource(file));

        OcrAnalysisResponse response = restClient.post()
                .uri("/ocr/analyze")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(OcrAnalysisResponse.class);
        if (response == null) {
            throw new IllegalStateException("OCR service returned an empty response");
        }
        return response;
    }

    private ByteArrayResource toResource(MultipartFile file) {
        try {
            return new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename() == null ? "invoice-file" : file.getOriginalFilename();
                }
            };
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read file for OCR analysis", exception);
        }
    }
}
