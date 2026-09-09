package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.AuditLogPageResponse;
import org.facturation.backend.dto.response.AuditLogResponse;
import org.facturation.backend.service.AuditLogQueryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/audit-logs")
@Tag(name = "Audit", description = "Consultation expurgee des journaux de l'organisation courante")
public class AuditLogController {
    private final AuditLogQueryService service;

    public AuditLogController(AuditLogQueryService service) { this.service = service; }

    @GetMapping
    @Operation(summary = "Consulter les evenements d'audit en lecture seule")
    public AuditLogPageResponse list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resource,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(page, size, userId, action, resource, from, to);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter le detail expurge d'un evenement d'audit")
    public AuditLogResponse detail(@PathVariable Long id) { return service.detail(id); }
}
