package org.facturation.backend.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "app.ocr.mock", havingValue = "false")
public class FastApiOcrClient implements OcrClient {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI analyzeUri;

    public FastApiOcrClient(@Value("${app.ocr.base-url}") String baseUrl) {
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
        this.analyzeUri = URI.create(normalizeBaseUrl(baseUrl) + "/ocr/analyze");
    }

    @Override
    public OcrAnalysisResponse analyze(MultipartFile file) {
        String boundary = UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildMultipartBody(file, boundary);

        HttpRequest request = HttpRequest.newBuilder(analyzeUri)
                .version(HttpClient.Version.HTTP_1_1)
                .header(HttpHeaders.CONTENT_TYPE, "multipart/form-data; boundary=" + boundary)
                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException(
                        "OCR service returned status "
                                + response.statusCode()
                                + ": "
                                + response.body()
                );
            }
            return objectMapper.readValue(response.body(), OcrAnalysisResponse.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to call OCR service", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OCR service call was interrupted", exception);
        }
    }

    private byte[] buildMultipartBody(MultipartFile file, String boundary) {
        String filename = sanitizeFilename(
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "invoice-file"
        );
        String contentType = resolveContentType(file);
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.write((
                    "Content-Disposition: form-data; name=\"file\"; filename=\""
                            + filename
                            + "\"\r\n"
            ).getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Type: " + contentType + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
            out.write(file.getBytes());
            out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return out.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read file for OCR analysis", exception);
        }
    }

    private String resolveContentType(MultipartFile file) {
        String ct = file.getContentType();
        return (ct != null && ct.contains("/")) ? ct : MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }

    private String normalizeBaseUrl(String baseUrl) {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String sanitizeFilename(String filename) {
        return filename
                .replace("\\", "_")
                .replace("\"", "_")
                .replace("\r", "_")
                .replace("\n", "_");
    }
}
