package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceValidationDecision;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceValidationDecisionRepository extends JpaRepository<InvoiceValidationDecision, Long> {

    @EntityGraph(attributePaths = "decidedByUser")
    List<InvoiceValidationDecision>
            findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByDecidedAtAscInvoiceValidationDecisionIdAsc(
                    Long invoiceId,
                    Long organizationId
            );
}
