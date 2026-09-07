package org.facturation.backend.repository;

import org.facturation.backend.model.ExportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExportBatchRepository extends JpaRepository<ExportBatch, Long> {
}
