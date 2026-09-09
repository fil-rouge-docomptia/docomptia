package org.facturation.backend.dto.response;

import java.time.LocalDateTime;

public record AuditLogResponse(Long id, Long organizationId, LocalDateTime occurredAt,
                               Actor actor, String action, String resource, Long resourceId, Change change) {
    public record Actor(Long id, String name) {}
    public record Change(String field, String previousValue, String newValue) {}
}
