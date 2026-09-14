package org.facturation.backend.dto.response;

import java.util.List;

public record AuditLogPageResponse(List<AuditLogResponse> content, int number, int size,
                                   long totalElements, int totalPages) {}
