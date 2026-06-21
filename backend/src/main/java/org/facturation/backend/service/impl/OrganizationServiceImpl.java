package org.facturation.backend.service.impl;

import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.service.OrganizationService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OrganizationServiceImpl implements OrganizationService {

    private final OrganizationRepository organizationRepository;

    public OrganizationServiceImpl(OrganizationRepository organizationRepository) {
        this.organizationRepository = organizationRepository;
    }

    @Override
    public List<Organization> findAll() {
        return organizationRepository.findAll();
    }

    @Override
    public Optional<Organization> findById(Long id) {
        return organizationRepository.findById(id);
    }

    @Override
    public Organization save(Organization organization) {
        return organizationRepository.save(organization);
    }
}
