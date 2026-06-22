package org.facturation.backend.controller;

import org.facturation.backend.client.OcrClient;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/ocr")
public class OcrController {

    private final OcrClient ocrClient;

    public OcrController(OcrClient ocrClient) {
        this.ocrClient = ocrClient;
    }

    @PostMapping("/analyze")
    public ResponseEntity<OcrAnalysisResponse> analyze(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ocrClient.analyze(file));
    }
}
