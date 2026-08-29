package org.facturation.backend.controller;

import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OrganizationControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void returnsTheAuthenticatedUsersOrganization() throws Exception {
        mockMvc.perform(get("/api/v1/organizations/current")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.organizationId").value(1))
                .andExpect(jsonPath("$.name").value("Facturation Demo"))
                .andExpect(jsonPath("$.legalName").value("Facturation Demo SARL"))
                .andExpect(jsonPath("$.siret").value("12345678901234"))
                .andExpect(jsonPath("$.email").value("contact@facturation-demo.fr"))
                .andExpect(jsonPath("$.phone").value("0102030405"))
                .andExpect(jsonPath("$.address").value("10 rue de Paris, 75001 Paris"));
    }

    @Test
    void returnsOnlyTheOrganizationAttachedToTheAuthenticatedUser() throws Exception {
        User user = createUserInAnotherOrganization();
        String token = new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(user);

        mockMvc.perform(get("/api/v1/organizations/current")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(user.getOrganization().getOrganizationId()))
                .andExpect(jsonPath("$.name").value("Another organization"))
                .andExpect(jsonPath("$.siret").value("73282932000077"));
    }

    @Test
    void updatesTheAuthenticatedOrganizationAndAuditsEachChangedField() throws Exception {
        mockMvc.perform(patch("/api/v1/organizations/current")
                        .header("Authorization", "Bearer " + loginAndGetToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Docomptia",
                                  "legalName": "Docomptia SAS",
                                  "siret": "73282932000074",
                                  "email": "CONTACT@DOCOMPTIA.FR",
                                  "phone": "",
                                  "address": "20 avenue de France, 75013 Paris"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId").value(1))
                .andExpect(jsonPath("$.name").value("Docomptia"))
                .andExpect(jsonPath("$.legalName").value("Docomptia SAS"))
                .andExpect(jsonPath("$.siret").value("73282932000074"))
                .andExpect(jsonPath("$.email").value("contact@docomptia.fr"))
                .andExpect(jsonPath("$.phone").doesNotExist())
                .andExpect(jsonPath("$.address").value("20 avenue de France, 75013 Paris"));

        Organization organization = organizationRepository.findById(1L).orElseThrow();
        List<AuditLog> auditLogs = auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        1L,
                        Organization.class.getSimpleName(),
                        1L,
                        "UPDATED"
                );

        org.assertj.core.api.Assertions.assertThat(organization.getName()).isEqualTo("Docomptia");
        org.assertj.core.api.Assertions.assertThat(auditLogs)
                .hasSize(6)
                .allMatch(auditLog -> auditLog.getUser().getUserId().equals(1L));
        org.assertj.core.api.Assertions.assertThat(auditLogs)
                .extracting(AuditLog::getNewValue)
                .containsExactlyInAnyOrder(
                        "name=Docomptia",
                        "legalName=Docomptia SAS",
                        "siret=73282932000074",
                        "email=contact@docomptia.fr",
                        "phone=",
                        "address=20 avenue de France, 75013 Paris"
                );
    }

    @Test
    void updatesOnlyTheOrganizationAttachedToTheAuthenticatedUser() throws Exception {
        User otherOrganizationUser = createUserInAnotherOrganization();
        String token = new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(otherOrganizationUser);

        mockMvc.perform(patch("/api/v1/organizations/current")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone":"0987654321"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizationId")
                        .value(otherOrganizationUser.getOrganization().getOrganizationId()))
                .andExpect(jsonPath("$.phone").value("0987654321"));

        org.assertj.core.api.Assertions.assertThat(organizationRepository.findById(1L).orElseThrow().getPhone())
                .isEqualTo("0102030405");
        org.assertj.core.api.Assertions.assertThat(organizationRepository
                        .findById(otherOrganizationUser.getOrganization().getOrganizationId())
                        .orElseThrow()
                        .getPhone())
                .isEqualTo("0987654321");
    }

    @Test
    void rejectsInvalidInformationWithoutChangingOrAuditingTheOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/organizations/current")
                        .header("Authorization", "Bearer " + loginAndGetToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Should not be applied","siret":"1234"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("siret must contain exactly 14 digits"));

        Organization organization = organizationRepository.findById(1L).orElseThrow();
        List<AuditLog> auditLogs = auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        1L,
                        Organization.class.getSimpleName(),
                        1L,
                        "UPDATED"
                );

        org.assertj.core.api.Assertions.assertThat(organization.getName()).isEqualTo("Facturation Demo");
        org.assertj.core.api.Assertions.assertThat(organization.getSiret()).isEqualTo("12345678901234");
        org.assertj.core.api.Assertions.assertThat(auditLogs).isEmpty();
    }

    @Test
    void rejectsASiretUsedByAnotherOrganizationWithoutChangingTheCurrentOrganization() throws Exception {
        createUserInAnotherOrganization();

        mockMvc.perform(patch("/api/v1/organizations/current")
                        .header("Authorization", "Bearer " + loginAndGetToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"siret":"73282932000077"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT"));

        org.assertj.core.api.Assertions.assertThat(organizationRepository.findById(1L).orElseThrow().getSiret())
                .isEqualTo("12345678901234");
    }

    @Test
    void rejectsUnauthenticatedRequests() throws Exception {
        mockMvc.perform(get("/api/v1/organizations/current"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void doesNotAllowSelectingAnOrganizationById() throws Exception {
        mockMvc.perform(get("/api/v1/organizations/1")
                        .header("Authorization", "Bearer " + loginAndGetToken()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private String loginAndGetToken() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@facturation-demo.fr","password":"admin123"}
                                """))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return new com.fasterxml.jackson.databind.ObjectMapper().readTree(response).get("token").asText();
    }

    private User createUserInAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Another organization");
        organization.setLegalName("Another organization SAS");
        organization.setSiret("73282932000077");
        organization.setEmail("contact@another-organization.fr");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organization = organizationRepository.save(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(userRepository.findById(1L).orElseThrow().getRole());
        user.setFirstName("Another");
        user.setLastName("Admin");
        user.setEmail("admin@another-organization.fr");
        user.setPasswordHash("unused");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }
}
