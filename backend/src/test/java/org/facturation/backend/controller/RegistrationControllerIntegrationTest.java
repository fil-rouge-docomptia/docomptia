package org.facturation.backend.controller;

import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RegistrationControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void createsOrganizationAndActiveAdministratorTogether() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationPayload(
                                " New organization ",
                                " New organization SAS ",
                                "73282932000074",
                                " NEW.ADMIN@Example.com "
                        )))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.organizationId").isNumber())
                .andExpect(jsonPath("$.userId").isNumber())
                .andExpect(jsonPath("$.email").value("new.admin@example.com"))
                .andExpect(jsonPath("$.role").value("ADMIN"));

        var administrator = userRepository.findByEmailIgnoreCase("new.admin@example.com").orElseThrow();
        assertThat(administrator.isActive()).isTrue();
        assertThat(administrator.getRole().getCode()).isEqualTo("ADMIN");
        assertThat(passwordEncoder.matches("registration-password", administrator.getPasswordHash())).isTrue();
        assertThat(administrator.getOrganization().getName()).isEqualTo("New organization");
        assertThat(administrator.getOrganization().getLegalName()).isEqualTo("New organization SAS");
        assertThat(administrator.getOrganization().getSiret()).isEqualTo("73282932000074");
        assertThat(administrator.getOrganization().getDefaultCurrencyCode()).isEqualTo("EUR");
        assertThat(administrator.getOrganization().isValidationRequired()).isTrue();
        assertThat(administrator.getOrganization().getValidationThreshold()).isNull();
    }

    @Test
    void rejectsEmailAlreadyUsedRegardlessOfCaseWithoutCreatingOrganization() throws Exception {
        long organizationCount = organizationRepository.count();

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationPayload(
                                "Duplicate email organization",
                                "Duplicate email organization SAS",
                                "73282932000074",
                                "ADMIN@FACTURATION-DEMO.FR"
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_EMAIL_CONFLICT"));

        assertThat(organizationRepository.count()).isEqualTo(organizationCount);
    }

    @Test
    void rejectsSiretAlreadyUsedWithoutCreatingAdministrator() throws Exception {
        long userCount = userRepository.count();

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationPayload(
                                "Duplicate SIRET organization",
                                "Duplicate SIRET organization SAS",
                                "55210055400013",
                                "unique-registration@example.com"
                        )))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT"));

        assertThat(userRepository.count()).isEqualTo(userCount);
    }

    @Test
    void rejectsInvalidSiret() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationPayload(
                                "Invalid organization",
                                "Invalid organization SAS",
                                "1234",
                                "invalid-siret@example.com"
                        )))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REGISTRATION_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("siret must be a valid French SIRET"));

    }

    @Test
    void rejectsSiretWithInvalidChecksum() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registrationPayload(
                                "Invalid organization",
                                "Invalid organization SAS",
                                "73282932000075",
                                "invalid-siret-checksum@example.com"
                        )))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REGISTRATION_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("siret must be a valid French SIRET"));
    }

    private String registrationPayload(
            String organizationName,
            String legalName,
            String siret,
            String email
    ) {
        return """
                {
                  "organizationName": "%s",
                  "legalName": "%s",
                  "siret": "%s",
                  "firstName": " Marie ",
                  "lastName": " Martin ",
                  "email": "%s",
                  "password": "registration-password"
                }
                """.formatted(organizationName, legalName, siret, email);
    }
}
