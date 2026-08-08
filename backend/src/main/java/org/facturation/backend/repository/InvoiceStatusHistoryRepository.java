package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceStatusHistory;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InvoiceStatusHistoryRepository extends JpaRepository<InvoiceStatusHistory, Long> {

    @EntityGraph(attributePaths = {"invoiceStatus", "changedByUser"})
    List<InvoiceStatusHistory>
            findByInvoiceInvoiceIdAndInvoiceOrganizationOrganizationIdOrderByChangedAtAscInvoiceStatusHistoryIdAsc(
                    Long invoiceId,
                    Long organizationId
            );
}
