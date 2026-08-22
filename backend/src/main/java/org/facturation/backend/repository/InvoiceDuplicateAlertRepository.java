package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

import org.facturation.backend.model.DuplicateAlertDecision;

public interface InvoiceDuplicateAlertRepository extends JpaRepository<InvoiceDuplicateAlert, Long> {

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
