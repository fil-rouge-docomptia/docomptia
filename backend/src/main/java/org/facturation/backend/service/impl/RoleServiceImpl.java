package org.facturation.backend.service.impl;

import org.facturation.backend.model.Role;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.service.RoleService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RoleServiceImpl implements RoleService {

    private final RoleRepository roleRepository;

    public RoleServiceImpl(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @Override
    public List<Role> findAll() {
        return roleRepository.findAll();
    }

    @Override
    public Optional<Role> findById(Long id) {
        return roleRepository.findById(id);
    }

    @Override
    public Role findByCode(RoleCode code) {
        return roleRepository.findByCode(code.getCode())
                .orElseThrow(() -> new IllegalStateException("Role " + code.getCode() + " not found"));
    }

    @Override
    public Role findByCode(String code) {
        return findByCode(RoleCode.fromCode(code));
    }

    @Override
    public Role save(Role role) {
        RoleCode.fromCode(role.getCode());
        return roleRepository.save(role);
    }
}
