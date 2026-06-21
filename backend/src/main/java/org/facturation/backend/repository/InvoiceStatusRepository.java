package org.facturation.backend.repository;

import org.facturation.backend.model.InvoiceStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InvoiceStatusRepository extends JpaRepository<InvoiceStatus, Long> {

    Optional<InvoiceStatus> findByCode(String code);
}
