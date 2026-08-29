package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.OrganizationResponse;
import org.facturation.backend.mapper.OrganizationResponseMapper;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.OrganizationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class OrganizationServiceImpl implements OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final CurrentUserService currentUserService;
    private final OrganizationResponseMapper organizationResponseMapper;

    public OrganizationServiceImpl(
            OrganizationRepository organizationRepository,
            CurrentUserService currentUserService,
            OrganizationResponseMapper organizationResponseMapper
    ) {
        this.organizationRepository = organizationRepository;
        this.currentUserService = currentUserService;
        this.organizationResponseMapper = organizationResponseMapper;
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

    @Override
    @Transactional(readOnly = true)
    public OrganizationResponse findCurrentOrganization() {
        return organizationResponseMapper.toResponse(currentUserService.getCurrentUser().getOrganization());
    }
}
