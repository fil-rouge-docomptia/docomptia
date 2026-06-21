package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceStatusHistoryRepository extends JpaRepository<InvoiceStatusHistory, Long> {
}
