package org.facturation.backend.controller;

import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = {
        "INSERT INTO organizations (organization_id, name, legal_name, siret, email, created_at, updated_at) "
                + "VALUES (9630, 'Other organization', 'Other organization SAS', '99999999999999', "
                + "'other-users@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (9631, 1, 2, 'Zoe', 'Accountant', "
                + "'zoe-accountant@example.com', 'not-returned', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (9632, 9630, 1, 'Hidden', 'User', "
                + "'hidden-user@example.com', 'not-returned', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, password_hash, "
                + "is_active, created_at, updated_at) VALUES (9633, 1, 2, 'Active', 'User', "
                + "'active-user@example.com', 'not-returned', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
})
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void returnsSortedPageWithoutSensitiveDataForCurrentOrganization() throws Exception {
        long expectedUsers = userRepository.findAll().stream()
                .filter(user -> user.getOrganization().getOrganizationId().equals(1L))
                .count();

        mockMvc.perform(get("/api/v1/users")
                        .param("page", "0")
                        .param("size", "1")
                        .param("sortBy", "firstName")
                        .param("direction", "DESC")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].firstName").value("Zoe"))
                .andExpect(jsonPath("$.content[0].lastName").value("Accountant"))
                .andExpect(jsonPath("$.content[0].email").value("zoe-accountant@example.com"))
                .andExpect(jsonPath("$.content[0].role.code").value("ACCOUNTANT"))
                .andExpect(jsonPath("$.content[0].active").value(false))
                .andExpect(jsonPath("$.content[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.content[0].organization").doesNotExist())
                .andExpect(jsonPath("$.totalElements").value(expectedUsers))
                .andExpect(jsonPath("$.totalPages").value(expectedUsers))
                .andExpect(jsonPath("$.number").value(0))
                .andExpect(jsonPath("$.size").value(1));

        mockMvc.perform(get("/api/v1/users")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].email", not(hasItem("hidden-user@example.com"))));
    }

    @Test
    void authorizedUserInvitesInactiveUserInCurrentOrganization() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": " Marie ",
                                  "lastName": " Martin ",
                                  "email": " MARIE.MARTIN@Example.com ",
                                  "roleCode": "ACCOUNTANT"
                                }
                                """)
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.firstName").value("Marie"))
                .andExpect(jsonPath("$.lastName").value("Martin"))
                .andExpect(jsonPath("$.email").value("marie.martin@example.com"))
                .andExpect(jsonPath("$.role.code").value("ACCOUNTANT"))
                .andExpect(jsonPath("$.roles[0].code").value("ACCOUNTANT"))
                .andExpect(jsonPath("$.active").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.organization").doesNotExist());

        var invitedUser = userRepository.findByEmailIgnoreCase("marie.martin@example.com").orElseThrow();
        assertThat(invitedUser.getOrganization().getOrganizationId()).isEqualTo(1L);
        assertThat(invitedUser.getPasswordHash()).startsWith("$2");
    }

    @Test
    void rejectsEmailAlreadyUsedRegardlessOfCase() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Other",
                                  "lastName": "Admin",
                                  "email": "ADMIN@FACTURATION-DEMO.FR",
                                  "roleCode": "ADMIN"
                                }
                                """)
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_EMAIL_CONFLICT"));
    }

    @Test
    void rejectsRoleOutsideAssignableRoles() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": "Invalid",
                                  "lastName": "Role",
                                  "email": "invalid-role@example.com",
                                  "roleCode": "SUPER_ADMIN"
                                }
                                """)
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("roleCode is not allowed"));
    }

    @Test
    void authorizedUserUpdatesUserIdentityInCurrentOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/users/{id}", 9631)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "firstName": " Alice ",
                                  "lastName": " Durand ",
                                  "email": " ALICE.DURAND@Example.com "
                                }
                                """)
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(9631))
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.lastName").value("Durand"))
                .andExpect(jsonPath("$.email").value("alice.durand@example.com"))
                .andExpect(jsonPath("$.role.code").value("ACCOUNTANT"))
                .andExpect(jsonPath("$.active").value(false));

        var updatedUser = userRepository.findById(9631L).orElseThrow();
        assertThat(updatedUser.getFirstName()).isEqualTo("Alice");
        assertThat(updatedUser.getLastName()).isEqualTo("Durand");
        assertThat(updatedUser.getEmail()).isEqualTo("alice.durand@example.com");
    }

    @Test
    void rejectsInvalidOrAlreadyUsedEmail() throws Exception {
        mockMvc.perform(patch("/api/v1/users/{id}", 9631)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"invalid-email\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("email must be valid"));

        mockMvc.perform(patch("/api/v1/users/{id}", 9631)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ADMIN@FACTURATION-DEMO.FR\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USER_EMAIL_CONFLICT"));
    }

    @Test
    void hidesUserFromAnotherOrganizationDuringUpdate() throws Exception {
        mockMvc.perform(patch("/api/v1/users/{id}", 9632)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Visible\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("User 9632 not found"));
    }

    @Test
    void rejectsUpdateWithoutEffectiveChange() throws Exception {
        mockMvc.perform(patch("/api/v1/users/{id}", 9631)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("At least one changed field is required"));
    }

    @Test
    void authorizedUserActivatesUserInCurrentOrganizationAndAuditsChange() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9631/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":true}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(9631))
                .andExpect(jsonPath("$.active").value(true));

        var auditLog = auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        1L,
                        "User",
                        9631L,
                        "STATUS_CHANGED"
                )
                .getFirst();
        assertThat(auditLog.getUser().getUserId()).isEqualTo(1L);
        assertThat(auditLog.getOldValue()).isEqualTo("active=false");
        assertThat(auditLog.getNewValue()).isEqualTo("active=true");
        assertThat(auditLog.getCreatedAt()).isNotNull();
    }

    @Test
    void authorizedUserCannotChangeUserFromAnotherOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9632/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
    }

    @Test
    void authorizedUserDeactivatesUserInCurrentOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9633/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        assertThat(userRepository.findById(9633L).orElseThrow().isActive()).isFalse();
        var auditLog = auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        1L,
                        "User",
                        9633L,
                        "STATUS_CHANGED"
                )
                .getFirst();
        assertThat(auditLog.getUser().getUserId()).isEqualTo(1L);
        assertThat(auditLog.getOldValue()).isEqualTo("active=true");
        assertThat(auditLog.getNewValue()).isEqualTo("active=false");
        assertThat(auditLog.getCreatedAt()).isNotNull();
    }

    @Test
    void rejectsDeactivationOfLastActiveOwner() throws Exception {
        mockMvc.perform(patch("/api/v1/users/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_OWNER"))
                .andExpect(jsonPath("$.message").value(
                        "The last active owner cannot be deactivated or lose the Owner role"));

        assertThat(userRepository.findById(1L).orElseThrow().isActive()).isTrue();
    }

    @Test
    void authorizedUserReplacesUserRolesInCurrentOrganizationAndAuditsChange() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9631/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCodes\":[\"accounting_manager\"]}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(9631))
                .andExpect(jsonPath("$.role.code").value("ACCOUNTING_MANAGER"))
                .andExpect(jsonPath("$.roles[0].code").value("ACCOUNTING_MANAGER"));

        assertThat(userRepository.findById(9631L).orElseThrow().getRole().getCode())
                .isEqualTo("ACCOUNTING_MANAGER");
        var auditLog = auditLogRepository
                .findByOrganizationOrganizationIdAndEntityNameAndEntityIdAndActionOrderByCreatedAtAscAuditLogIdAsc(
                        1L,
                        "User",
                        9631L,
                        "ROLES_CHANGED"
                )
                .getFirst();
        assertThat(auditLog.getUser().getUserId()).isEqualTo(1L);
        assertThat(auditLog.getOldValue()).isEqualTo("roles=ACCOUNTANT");
        assertThat(auditLog.getNewValue()).isEqualTo("roles=ACCOUNTING_MANAGER");
        assertThat(auditLog.getCreatedAt()).isNotNull();
    }

    @Test
    void rejectsRoleChangeOfLastActiveOwner() throws Exception {
        mockMvc.perform(patch("/api/v1/users/1/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ACCOUNTANT\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LAST_ACTIVE_OWNER"));

        assertThat(userRepository.findById(1L).orElseThrow().getRole().getCode()).isEqualTo("OWNER");
    }

    @Test
    void allowsDeactivationWhenAnotherActiveOwnerExists() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9633/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"OWNER\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/users/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    void allowsRoleChangeWhenAnotherActiveOwnerExists() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9633/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"OWNER\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/users/1/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ACCOUNTING_MANAGER\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role.code").value("ACCOUNTING_MANAGER"));
    }

    @Test
    void ownerRoleChangesRequireOwnerManagementPermission() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9633/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ADMIN\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/users/9631/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"OWNER\"}")
                        .header("Authorization", "Bearer " + tokenFor("active-user@example.com")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void authorizedUserCannotChangeRoleForUserFromAnotherOrganization() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9632/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ACCOUNTANT\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
    }

    @Test
    void rejectsRoleOutsideAssignableRolesDuringRoleChange() throws Exception {
        mockMvc.perform(patch("/api/v1/users/9631/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"SUPER_ADMIN\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USER_VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("roleCode is not allowed"));
    }

    @Test
    void appliesChangedRoleImmediatelyToExistingToken() throws Exception {
        String existingToken = tokenFor("active-user@example.com");

        mockMvc.perform(get("/api/v1/roles")
                        .header("Authorization", "Bearer " + existingToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/users/9633/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roleCode\":\"ADMIN\"}")
                        .header("Authorization", "Bearer " + ownerToken()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/roles")
                        .header("Authorization", "Bearer " + existingToken))
                .andExpect(status().isOk());
    }

    private String ownerToken() {
        return tokenFor("admin@facturation-demo.fr");
    }

    private String tokenFor(String email) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase(email).orElseThrow());
    }
}
