package org.facturation.backend.repository;

import org.facturation.backend.model.ExportBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;

import java.util.Optional;

public interface ExportBatchRepository extends JpaRepository<ExportBatch, Long> {

    Optional<ExportBatch> findByExportBatchIdAndOrganizationOrganizationId(Long exportBatchId, Long organizationId);

    @EntityGraph(attributePaths = "createdByUser")
    @Query("""
            select b from ExportBatch b
            where b.organization.organizationId = :organizationId
              and (:query = '' or lower(coalesce(b.fileName, '')) like concat('%', :query, '%')
                   or cast(b.exportBatchId as string) = :query)
              and (:status is null or b.status = :status)
              and (:format is null or b.format = :format)
              and (:hasStart = false or b.createdAt >= :start)
              and (:hasEnd = false or b.createdAt < :end)
            """)
    Page<ExportBatch> findHistory(Long organizationId, String query, String status, String format,
            boolean hasStart, LocalDateTime start, boolean hasEnd, LocalDateTime end, Pageable pageable);

    long countByOrganizationOrganizationIdAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThan(
            Long organizationId, LocalDateTime start, LocalDateTime end);
}
