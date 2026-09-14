package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.OcrErrorResponse;
import org.facturation.backend.model.OcrError;
import org.springframework.stereotype.Component;

@Component
public class OcrErrorMapper {

    public OcrErrorResponse toResponse(OcrError error) {
        OcrErrorResponse response = new OcrErrorResponse();
        response.setCode(error.getErrorCode());
        response.setMessage(error.getErrorMessage());
        response.setStep(error.getErrorStep());
        response.setOccurredAt(error.getOccurredAt().toString());
        return response;
    }
}
