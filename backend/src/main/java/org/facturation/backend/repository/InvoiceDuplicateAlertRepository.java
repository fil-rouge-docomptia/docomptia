package org.facturation.backend.repository;

import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvoiceDuplicateAlertRepository extends JpaRepository<InvoiceDuplicateAlert, Long> {

    @Query("""
            select count(distinct alert.invoice.invoiceId)
            from InvoiceDuplicateAlert alert
            where alert.invoice.organization.organizationId = :organizationId
              and alert.decision = :decision
              and (:startDate is null or alert.invoice.invoiceDate >= :startDate)
              and (:endDate is null or alert.invoice.invoiceDate <= :endDate)
            """)
    long countDistinctInvoicesForDashboard(
            @Param("organizationId") Long organizationId,
            @Param("decision") DuplicateAlertDecision decision,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );

    @EntityGraph(attributePaths = {"matchingInvoice", "supplier"})
    List<InvoiceDuplicateAlert> findByInvoiceInvoiceIdOrderByCreatedAtAsc(Long invoiceId);

    boolean existsByInvoiceInvoiceIdAndMatchingInvoiceInvoiceId(Long invoiceId, Long matchingInvoiceId);

    @EntityGraph(attributePaths = {"invoice", "invoice.invoiceStatus"})
    Optional<InvoiceDuplicateAlert> findByDuplicateAlertIdAndInvoiceInvoiceIdAndInvoiceOrganizationOrganizationId(
            Long duplicateAlertId,
            Long invoiceId,
            Long organizationId
    );

    boolean existsByInvoiceInvoiceIdAndDecision(Long invoiceId, DuplicateAlertDecision decision);

    @EntityGraph(attributePaths = "decidedByUser")
    List<InvoiceDuplicateAlert>
    findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdAndDecidedAtIsNotNullOrderByDecidedAtAscDuplicateAlertIdAsc(
            Long invoiceId,
            Long organizationId
    );
}
