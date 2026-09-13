package org.facturation.backend.service;

import org.facturation.backend.dto.response.AuditLogPageResponse;
import org.facturation.backend.dto.response.AuditLogResponse;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class AuditLogQueryService {
    private static final Set<String> ACTIONS = Set.of("STATUS_CHANGED", "ROLE_CHANGED", "UPDATED",
            "CSV_IMPORT", "FIELD_CORRECTION", "LINE_CORRECTION", "LINE_ADDED", "LINE_REMOVED", "ASSIGNEE_CHANGED",
            "ACCOUNTING_ENTRY_REVERSED", "ACCOUNTING_ENTRY_CREATED", "CSV_EXPORT", "FEC_EXPORT", "ADMINISTRATIVELY_DELETED");
    private static final Set<String> RESOURCES = Set.of("User", "Organization", "Invoice",
            "AccountingEntryLine", "AccountingEntry", "ChartOfAccount", "AccountingCsvExport", "AccountingFecExport");
    private static final Set<String> ROLES = Set.of("role=ADMIN", "role=OPERATEUR_COMPTABLE",
            "role=RESPONSABLE_COMPTABLE");
    private static final Set<String> STATUSES = Set.of("active=true", "active=false");

    private final AuditLogRepository repository;
    private final CurrentUserService currentUserService;

    public AuditLogQueryService(AuditLogRepository repository, CurrentUserService currentUserService) {
        this.repository = repository;
        this.currentUserService = currentUserService;
    }

    public AuditLogPageResponse list(int page, int size, Long userId, String action, String resource,
                                     LocalDate from, LocalDate to) {
        Long organizationId = currentOrganization();
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE
                || (userId != null && userId <= 0)
                || !validFilter(action, ACTIONS) || !validFilter(resource, RESOURCES)
                || (from != null && (from.getYear() < 1 || from.getYear() > 9998))
                || (to != null && (to.getYear() < 1 || to.getYear() > 9998))
                || (from != null && to != null && from.isAfter(to))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid audit filters");
        }
        Specification<AuditLog> filter = inOrganization(organizationId);
        if (userId != null) {
            filter = filter.and((root, query, cb) -> cb.and(
                    cb.equal(root.get("user").get("userId"), userId),
                    cb.equal(root.get("user").get("organization").get("organizationId"), organizationId)));
        }
        if (action != null && !action.isBlank()) filter = filter.and(codeFilter("action", action, ACTIONS));
        if (resource != null && !resource.isBlank()) filter = filter.and(codeFilter("entityName", resource, RESOURCES));
        if (from != null) filter = filter.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay()));
        if (to != null) filter = filter.and((root, query, cb) -> cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay()));
        var result = repository.findAll(filter, PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt", "auditLogId")));
        return new AuditLogPageResponse(result.getContent().stream().map(this::toResponse).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public AuditLogResponse detail(Long id) {
        Long organizationId = currentOrganization();
        return repository.findOne(inOrganization(organizationId)
                        .and((root, query, cb) -> cb.equal(root.get("auditLogId"), id)))
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Audit event not found"));
    }

    private Long currentOrganization() {
        User user = currentUserService.getCurrentUser();
        if (!user.isActive() || !RoleCode.ADMIN.getCode().equals(user.getRole().getCode())) {
            throw new AccessDeniedException("Audit access requires an administrator");
        }
        return user.getOrganization().getOrganizationId();
    }

    private Specification<AuditLog> inOrganization(Long id) {
        return (root, query, cb) -> cb.equal(root.get("organization").get("organizationId"), id);
    }

    private boolean validFilter(String value, Set<String> known) {
        return value == null || value.isBlank() || known.contains(value) || "OTHER".equals(value);
    }

    private Specification<AuditLog> codeFilter(String field, String value, Set<String> known) {
        return (root, query, cb) -> "OTHER".equals(value)
                ? cb.not(root.get(field).in(known)) : cb.equal(root.get(field), value);
    }

    private AuditLogResponse toResponse(AuditLog log) {
        Long organizationId = log.getOrganization().getOrganizationId();
        User user = log.getUser();
        AuditLogResponse.Actor actor = user != null
                && organizationId.equals(user.getOrganization().getOrganizationId())
                ? new AuditLogResponse.Actor(user.getUserId(), user.getFirstName() + " " + user.getLastName()) : null;
        String action = ACTIONS.contains(log.getAction()) ? log.getAction() : "OTHER";
        String resource = RESOURCES.contains(log.getEntityName()) ? log.getEntityName() : "OTHER";
        // Stored values can contain documents or credentials. Only these finite values may leave the service.
        AuditLogResponse.Change change = null;
        if ("User".equals(resource)) {
            Set<String> allowed = "ROLE_CHANGED".equals(action) ? ROLES
                    : "STATUS_CHANGED".equals(action) ? STATUSES : Set.of();
            if (log.getOldValue() != null && log.getNewValue() != null
                    && allowed.contains(log.getOldValue()) && allowed.contains(log.getNewValue())) {
                change = new AuditLogResponse.Change("ROLE_CHANGED".equals(action) ? "role" : "active",
                        log.getOldValue().split("=", 2)[1], log.getNewValue().split("=", 2)[1]);
            }
        }
        return new AuditLogResponse(log.getAuditLogId(), organizationId, log.getCreatedAt(), actor,
                action, resource, "OTHER".equals(resource) ? null : log.getEntityId(), change);
    }
}
