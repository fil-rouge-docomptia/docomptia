package org.facturation.backend.client;

import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.springframework.web.multipart.MultipartFile;

public interface OcrClient {

    OcrAnalysisResponse analyze(MultipartFile file);
}
