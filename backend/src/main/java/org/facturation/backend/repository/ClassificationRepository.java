package org.facturation.backend.repository;

import org.facturation.backend.model.Classification;
import org.facturation.backend.model.ClassificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClassificationRepository extends JpaRepository<Classification, Long> {
    Page<Classification> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);
    Page<Classification> findByOrganizationOrganizationIdAndType(
            Long organizationId, ClassificationType type, Pageable pageable);
    Optional<Classification> findByClassificationIdAndOrganizationOrganizationId(Long id, Long organizationId);
    boolean existsByOrganizationOrganizationIdAndTypeAndNameIgnoreCase(
            Long organizationId, ClassificationType type, String name);
    boolean existsByOrganizationOrganizationIdAndTypeAndNameIgnoreCaseAndClassificationIdNot(
            Long organizationId, ClassificationType type, String name, Long classificationId);
}
