package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceComment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceCommentRepository extends JpaRepository<InvoiceComment, Long> {

    @EntityGraph(attributePaths = "author")
    List<InvoiceComment> findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByCreatedAtAscInvoiceCommentIdAsc(
            Long invoiceId,
            Long organizationId
    );
}
