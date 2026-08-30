package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.ClassificationResponse;
import org.facturation.backend.model.Classification;
import org.springframework.stereotype.Component;

@Component
public class ClassificationResponseMapper {
    public ClassificationResponse toResponse(Classification classification) {
        ClassificationResponse response = new ClassificationResponse();
        response.setClassificationId(classification.getClassificationId());
        response.setType(classification.getType().name());
        response.setName(classification.getName());
        response.setDescription(classification.getDescription());
        response.setActive(classification.isActive());
        response.setCreatedAt(classification.getCreatedAt());
        response.setUpdatedAt(classification.getUpdatedAt());
        return response;
    }
}
