package org.facturation.backend.repository;

import org.facturation.backend.model.AuditLog;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    @EntityGraph(attributePaths = "user")
    List<AuditLog> findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
            Long organizationId,
            String entityName,
            Long entityId,
            String action
    );
}
