package org.facturation.backend.repository;

import org.facturation.backend.model.Invoice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    @EntityGraph(attributePaths = {"invoiceStatus", "organization", "supplier"})
    Optional<Invoice> findForOcrRetryByInvoiceId(Long invoiceId);
}
