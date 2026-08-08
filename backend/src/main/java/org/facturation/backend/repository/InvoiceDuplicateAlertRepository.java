package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceDuplicateAlert;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceDuplicateAlertRepository extends JpaRepository<InvoiceDuplicateAlert, Long> {

    @EntityGraph(attributePaths = {"matchingInvoice", "supplier"})
    List<InvoiceDuplicateAlert> findByInvoiceInvoiceIdOrderByCreatedAtAsc(Long invoiceId);

    boolean existsByInvoiceInvoiceIdAndMatchingInvoiceInvoiceId(Long invoiceId, Long matchingInvoiceId);
}
