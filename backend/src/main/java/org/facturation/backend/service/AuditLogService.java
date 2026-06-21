package org.facturation.backend.service;

import org.facturation.backend.model.AuditLog;

import java.util.List;
import java.util.Optional;

public interface AuditLogService {

    List<AuditLog> findAll();

    Optional<AuditLog> findById(Long id);

    AuditLog save(AuditLog auditLog);
}
