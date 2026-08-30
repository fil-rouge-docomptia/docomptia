package org.facturation.backend.service;

import org.facturation.backend.dto.request.ClassificationCreateRequest;
import org.facturation.backend.dto.request.ClassificationUpdateRequest;
import org.facturation.backend.dto.response.ClassificationResponse;
import org.facturation.backend.model.Classification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ClassificationService {
    Page<ClassificationResponse> findPage(String type, Pageable pageable);
    ClassificationResponse findDetailsById(Long id);
    ClassificationResponse create(ClassificationCreateRequest request);
    ClassificationResponse update(Long id, ClassificationUpdateRequest request);
    ClassificationResponse deactivate(Long id);
    Classification findRequiredActiveForCurrentOrganization(Long id);
}
