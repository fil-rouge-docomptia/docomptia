package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceCommentRepository extends JpaRepository<InvoiceComment, Long> {

    @EntityGraph(attributePaths = "author")
    Page<InvoiceComment> findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByCreatedAtAscInvoiceCommentIdAsc(
            Long invoiceId,
            Long organizationId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = "author")
    List<InvoiceComment> findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByCreatedAtAscInvoiceCommentIdAsc(
            Long invoiceId,
            Long organizationId
    );
}
