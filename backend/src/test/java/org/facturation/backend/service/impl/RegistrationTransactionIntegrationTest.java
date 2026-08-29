package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.RegistrationRequest;
import org.facturation.backend.exception.UserEmailConflictException;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.RegistrationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class RegistrationTransactionIntegrationTest {

    @Autowired
    private RegistrationService registrationService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @MockitoBean
    private UserRepository userRepository;

    @Test
    void rollsBackOrganizationWhenAdministratorPersistenceFails() {
        long organizationCount = organizationRepository.count();
        when(userRepository.existsByEmailIgnoreCase("rollback@example.com")).thenReturn(false);
        when(userRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("email conflict"));

        assertThatThrownBy(() -> registrationService.register(registrationRequest()))
                .isInstanceOf(UserEmailConflictException.class);

        assertThat(organizationRepository.count()).isEqualTo(organizationCount);
        assertThat(organizationRepository.existsBySiret("73282932000076")).isFalse();
    }

    private RegistrationRequest registrationRequest() {
        RegistrationRequest request = new RegistrationRequest();
        request.setOrganizationName("Rollback organization");
        request.setLegalName("Rollback organization SAS");
        request.setSiret("73282932000076");
        request.setFirstName("Rollback");
        request.setLastName("Admin");
        request.setEmail("rollback@example.com");
        request.setPassword("registration-password");
        return request;
    }
}
