package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.RoleResponse;
import org.facturation.backend.model.Role;
import org.facturation.backend.service.RoleService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/roles")
@Tag(name = "Roles", description = "Consultation des roles attribuables")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    @Operation(summary = "Lister les roles disponibles")
    public ResponseEntity<List<RoleResponse>> listRoles() {
        List<RoleResponse> roles = roleService.findAll().stream()
                .map(RoleController::toResponse)
                .toList();
        return ResponseEntity.ok(roles);
    }

    private static RoleResponse toResponse(Role role) {
        return new RoleResponse(role.getCode(), role.getLabel());
    }
}
