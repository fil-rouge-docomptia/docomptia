package org.facturation.backend.repository;

import org.facturation.backend.model.ProcessingAnomaly;
import org.facturation.backend.model.ProcessingAnomalyCode;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProcessingAnomalyRepository extends JpaRepository<ProcessingAnomaly, Long> {

    @EntityGraph(attributePaths = {"invoice", "organization"})
    Optional<ProcessingAnomaly> findByInvoiceInvoiceIdAndCodeAndResolvedAtIsNull(
            Long invoiceId,
            ProcessingAnomalyCode code
    );

    @EntityGraph(attributePaths = {"invoice", "organization"})
    List<ProcessingAnomaly> findByOrganizationOrganizationIdAndResolvedAtIsNullOrderByCreatedAtDescProcessingAnomalyIdDesc(
            Long organizationId
    );

    @EntityGraph(attributePaths = {"invoice", "organization"})
    List<ProcessingAnomaly> findByOrganizationOrganizationIdOrderByCreatedAtDescProcessingAnomalyIdDesc(
            Long organizationId
    );

    @EntityGraph(attributePaths = {"invoice", "organization"})
    Optional<ProcessingAnomaly> findByProcessingAnomalyIdAndInvoiceInvoiceIdAndOrganizationOrganizationId(
            Long anomalyId,
            Long invoiceId,
            Long organizationId
    );
}
