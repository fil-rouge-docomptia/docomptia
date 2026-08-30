package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.ClassificationCreateRequest;
import org.facturation.backend.dto.request.ClassificationUpdateRequest;
import org.facturation.backend.dto.response.ClassificationResponse;
import org.facturation.backend.exception.ClassificationConflictException;
import org.facturation.backend.exception.ClassificationNotFoundException;
import org.facturation.backend.exception.InvalidClassificationException;
import org.facturation.backend.mapper.ClassificationResponseMapper;
import org.facturation.backend.model.Classification;
import org.facturation.backend.model.ClassificationType;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.ClassificationRepository;
import org.facturation.backend.service.ClassificationService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Objects;

@Service
public class ClassificationServiceImpl implements ClassificationService {
    private final ClassificationRepository repository;
    private final ClassificationResponseMapper mapper;
    private final CurrentUserService currentUserService;

    public ClassificationServiceImpl(ClassificationRepository repository,
                                     ClassificationResponseMapper mapper,
                                     CurrentUserService currentUserService) {
        this.repository = repository;
        this.mapper = mapper;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ClassificationResponse> findPage(String type, Pageable pageable) {
        Long organizationId = currentOrganization().getOrganizationId();
        Page<Classification> classifications = type == null || type.isBlank()
                ? repository.findByOrganizationOrganizationId(organizationId, pageable)
                : repository.findByOrganizationOrganizationIdAndType(organizationId, parseType(type), pageable);
        return classifications.map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ClassificationResponse findDetailsById(Long id) { return mapper.toResponse(findRequired(id)); }

    @Override
    @Transactional
    public ClassificationResponse create(ClassificationCreateRequest request) {
        Organization organization = currentOrganization();
        ClassificationType type = parseType(request == null ? null : request.getType());
        String name = requireName(request.getName());
        ensureNameAvailable(organization.getOrganizationId(), type, name, null);
        LocalDateTime now = LocalDateTime.now();
        Classification classification = new Classification();
        classification.setOrganization(organization);
        classification.setType(type);
        classification.setName(name);
        classification.setDescription(normalizeDescription(request.getDescription()));
        classification.setActive(true);
        classification.setCreatedAt(now);
        classification.setUpdatedAt(now);
        return mapper.toResponse(save(classification));
    }

    @Override
    @Transactional
    public ClassificationResponse update(Long id, ClassificationUpdateRequest request) {
        Classification classification = findRequired(id);
        boolean changed = false;
        if (request != null && request.getName() != null) {
            String name = requireName(request.getName());
            if (!Objects.equals(classification.getName(), name)) {
                ensureNameAvailable(classification.getOrganization().getOrganizationId(), classification.getType(), name, id);
                classification.setName(name);
                changed = true;
            }
        }
        if (request != null && request.getDescription() != null) {
            String description = normalizeDescription(request.getDescription());
            if (!Objects.equals(classification.getDescription(), description)) {
                classification.setDescription(description);
                changed = true;
            }
        }
        if (!changed) throw new InvalidClassificationException("At least one changed field is required");
        classification.setUpdatedAt(LocalDateTime.now());
        return mapper.toResponse(save(classification));
    }

    @Override
    @Transactional
    public ClassificationResponse deactivate(Long id) {
        Classification classification = findRequired(id);
        if (!classification.isActive()) throw new InvalidClassificationException("Classification is already inactive");
        classification.setActive(false);
        classification.setUpdatedAt(LocalDateTime.now());
        return mapper.toResponse(repository.save(classification));
    }

    @Override
    @Transactional(readOnly = true)
    public Classification findRequiredActiveForCurrentOrganization(Long id) {
        Classification classification = findRequired(id);
        if (!classification.isActive()) throw new InvalidClassificationException("Classification is inactive");
        return classification;
    }

    private Classification findRequired(Long id) {
        return repository.findByClassificationIdAndOrganizationOrganizationId(
                id, currentOrganization().getOrganizationId()).orElseThrow(() -> new ClassificationNotFoundException(id));
    }

    private ClassificationType parseType(String value) {
        if (value == null || value.isBlank()) throw new InvalidClassificationException("type is required");
        try { return ClassificationType.valueOf(value.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException exception) {
            throw new InvalidClassificationException("type must be DOSSIER, CLASSEUR or CHANTIER");
        }
    }

    private String requireName(String value) {
        if (value == null || value.isBlank()) throw new InvalidClassificationException("name is required");
        return value.trim();
    }

    private String normalizeDescription(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void ensureNameAvailable(Long organizationId, ClassificationType type, String name, Long excludedId) {
        boolean exists = excludedId == null
                ? repository.existsByOrganizationOrganizationIdAndTypeAndNameIgnoreCase(organizationId, type, name)
                : repository.existsByOrganizationOrganizationIdAndTypeAndNameIgnoreCaseAndClassificationIdNot(
                        organizationId, type, name, excludedId);
        if (exists) throw new ClassificationConflictException(name);
    }

    private Classification save(Classification classification) {
        try { return repository.saveAndFlush(classification); }
        catch (DataIntegrityViolationException exception) { throw new ClassificationConflictException(classification.getName()); }
    }

    private Organization currentOrganization() { return currentUserService.getCurrentUser().getOrganization(); }
}
