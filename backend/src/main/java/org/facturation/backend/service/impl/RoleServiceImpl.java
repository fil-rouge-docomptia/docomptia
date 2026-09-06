package org.facturation.backend.service.impl;

import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.service.RoleService;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class RoleServiceImpl implements RoleService {

    private final RoleRepository roleRepository;

    public RoleServiceImpl(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @Override
    public List<Role> findAll() {
        List<String> systemRoleOrder = Arrays.stream(RoleCode.values())
                .map(RoleCode::getCode)
                .toList();
        return roleRepository.findBySystemRoleTrue().stream()
                .sorted(Comparator.comparingInt(role -> systemRoleOrder.indexOf(role.getCode())))
                .toList();
    }

    @Override
    public Optional<Role> findById(Long id) {
        return roleRepository.findById(id);
    }

    @Override
    public Role findByCode(RoleCode code) {
        return roleRepository.findByCodeAndSystemRoleTrue(code.getCode())
                .orElseThrow(() -> new IllegalStateException("Role " + code.getCode() + " not found"));
    }

    @Override
    public Role findByCode(String code) {
        return findByCode(RoleCode.fromCode(code));
    }

    @Override
    public Role findAssignableRole(String code, Long organizationId) {
        String normalizedCode = code == null ? null : code.trim().toUpperCase(Locale.ROOT);
        if (normalizedCode == null || normalizedCode.isBlank()) {
            throw new IllegalArgumentException("roleCode is required");
        }
        return roleRepository.findByCodeAndSystemRoleTrue(normalizedCode)
                .or(() -> roleRepository.findByCodeAndOrganizationOrganizationId(normalizedCode, organizationId))
                .orElseThrow(() -> new IllegalArgumentException("roleCode is not allowed"));
    }

    @Override
    public Role save(Role role) {
        return roleRepository.save(role);
    }
}
