package org.facturation.backend.repository;

import org.facturation.backend.model.ExportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ExportBatchRepository extends JpaRepository<ExportBatch, Long> {

    Optional<ExportBatch> findByExportBatchIdAndOrganizationOrganizationId(Long exportBatchId, Long organizationId);
}
