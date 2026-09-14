package org.facturation.backend.controller;

import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuditLogControllerIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired AuditLogRepository logs;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired RoleRepository roles;
    @Value("${app.jwt.secret}") String secret;
    private User admin;
    private String token;

    @BeforeEach
    void setUp() {
        logs.deleteAll();
        admin = users.findById(1L).orElseThrow();
        token = token(admin);
    }

    @Test
    void listsAndReadsOnlyCurrentOrganizationWithStablePagination() throws Exception {
        AuditLog first = event(admin, "User", "ROLE_CHANGED", "role=ADMIN", "role=OPERATEUR_COMPTABLE");
        AuditLog second = event(admin, "User", "STATUS_CHANGED", "active=true", "active=false");
        AuditLog foreign = event(otherAdmin(), "User", "ROLE_CHANGED", "role=ADMIN", "role=OPERATEUR_COMPTABLE");
        mvc.perform(get("/api/v1/audit-logs?size=1&organizationId=" + foreign.getOrganization().getOrganizationId())
                        .header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2)).andExpect(jsonPath("$.content[0].id").value(second.getAuditLogId()))
                .andExpect(jsonPath("$.content[0].organizationId").value(admin.getOrganization().getOrganizationId()));
        mvc.perform(get("/api/v1/audit-logs?size=1&page=1").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.content[0].id").value(first.getAuditLogId()));
        mvc.perform(get("/api/v1/audit-logs/" + foreign.getAuditLogId()).header("Authorization", token))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/audit-logs/" + first.getAuditLogId()).header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.change.field").value("role"))
                .andExpect(jsonPath("$.change.previousValue").value("ADMIN"))
                .andExpect(jsonPath("$.change.newValue").value("OPERATEUR_COMPTABLE"));
        assertThat(logs.count()).isEqualTo(3);
    }

    @Test
    void combinesActorActionResourceAndInclusiveDateFilters() throws Exception {
        AuditLog selected = event(admin, "User", "STATUS_CHANGED", "active=false", "active=true");
        selected.setCreatedAt(LocalDateTime.of(2026, 9, 9, 23, 59, 59));
        logs.save(selected);
        event(admin, "Organization", "UPDATED", "private", "private");
        AuditLog nextDay = event(admin, "User", "STATUS_CHANGED", "active=true", "active=false");
        nextDay.setCreatedAt(LocalDateTime.of(2026, 9, 10, 0, 0));
        logs.save(nextDay);
        mvc.perform(get("/api/v1/audit-logs?userId=" + admin.getUserId()
                        + "&action=STATUS_CHANGED&resource=User&from=2026-09-09&to=2026-09-09").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(selected.getAuditLogId()));
    }

    @Test
    void hidesRawValuesAndUnknownCodesOnListAndDetail() throws Exception {
        AuditLog log = event(admin, "Invoice", "FIELD_CORRECTION", "password=PRIVATE_SECRET", "invoice=PRIVATE_CONTENT");
        event(admin, "SECRET_RESOURCE", "SECRET_ACTION", "token=PRIVATE_TOKEN", "PRIVATE_CONTENT");
        mvc.perform(get("/api/v1/audit-logs").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(content().string(not(containsString("PRIVATE_"))))
                .andExpect(content().string(not(containsString("SECRET_"))))
                .andExpect(content().string(not(containsString("oldValue"))))
                .andExpect(content().string(not(containsString("passwordHash"))))
                .andExpect(jsonPath("$.content[0].action").value("OTHER"))
                .andExpect(jsonPath("$.content[0].resource").value("OTHER"))
                .andExpect(jsonPath("$.content[0].resourceId").doesNotExist());
        mvc.perform(get("/api/v1/audit-logs/" + log.getAuditLogId()).header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.change").doesNotExist())
                .andExpect(content().string(not(containsString("PRIVATE_"))));
        mvc.perform(get("/api/v1/audit-logs?action=OTHER&resource=OTHER").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }

    @ParameterizedTest
    @ValueSource(strings = {"role=ADMIN;token=PRIVATE_SECRET", "role=UNKNOWN", "ADMIN", "", "active=true"})
    void omitsUnrecognizedRoleChanges(String raw) throws Exception {
        AuditLog log = event(admin, "User", "ROLE_CHANGED", "role=ADMIN", raw);
        mvc.perform(get("/api/v1/audit-logs/" + log.getAuditLogId()).header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.change").doesNotExist())
                .andExpect(content().string(not(containsString("PRIVATE_SECRET"))));
    }

    @Test
    void keepsMissingOrForeignActorsAnonymousWithoutInventingSystemAttribution() throws Exception {
        AuditLog missing = event(admin, "User", "STATUS_CHANGED", null, null);
        missing.setUser(null);
        missing.setCreatedAt(null);
        logs.save(missing);
        User foreign = otherAdmin();
        AuditLog linked = event(admin, "User", "STATUS_CHANGED", "active=true", "active=false");
        linked.setUser(foreign);
        logs.save(linked);
        for (AuditLog log : new AuditLog[]{missing, linked}) {
            mvc.perform(get("/api/v1/audit-logs/" + log.getAuditLogId()).header("Authorization", token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.actor").doesNotExist())
                    .andExpect(content().string(not(containsString("Foreign"))));
        }
        mvc.perform(get("/api/v1/audit-logs?userId=" + foreign.getUserId()).header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void returnsAnEmptyPageAndMissingDetail() throws Exception {
        mvc.perform(get("/api/v1/audit-logs").header("Authorization", token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.size").value(25)).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/audit-logs/999999").header("Authorization", token)).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "size=0", "size=101", "page=2147483647&size=100", "userId=0",
            "action=SECRET", "resource=SECRET", "from=2026-09-10&to=2026-09-09", "from=invalid", "to=9999-12-31"})
    void rejectsInvalidFilters(String query) throws Exception {
        mvc.perform(get("/api/v1/audit-logs?" + query).header("Authorization", token)).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsAnonymousRequestsAndAllMutationMethods() throws Exception {
        mvc.perform(get("/api/v1/audit-logs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/audit-logs/1")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/audit-logs").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/audit-logs/1").header("Authorization", token)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/audit-logs/1").header("Authorization", token)).andExpect(status().isForbidden());
    }

    @Test
    void rejectsBothNonAdministratorRoles() throws Exception {
        for (String role : new String[]{"OPERATEUR_COMPTABLE", "RESPONSABLE_COMPTABLE"}) {
            User user = new User();
            user.setOrganization(admin.getOrganization());
            user.setRole(roles.findByCode(role).orElseThrow());
            user.setFirstName("Audit");
            user.setLastName("Reader");
            user.setEmail(role + "@example.test");
            user.setPasswordHash("unused");
            user.setActive(true);
            users.saveAndFlush(user);
            mvc.perform(get("/api/v1/audit-logs").header("Authorization", token(user))).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/audit-logs/1").header("Authorization", token(user))).andExpect(status().isForbidden());
        }
    }

    private AuditLog event(User actor, String resource, String action, String before, String after) {
        AuditLog log = new AuditLog();
        log.setOrganization(actor.getOrganization());
        log.setUser(actor);
        log.setEntityName(resource);
        log.setEntityId(actor.getUserId());
        log.setAction(action);
        log.setOldValue(before);
        log.setNewValue(after);
        log.setCreatedAt(LocalDateTime.of(2026, 9, 9, 10, 0));
        return logs.saveAndFlush(log);
    }

    private String token(User user) {
        return "Bearer " + new JwtTokenService(secret, Duration.ofHours(1)).generate(user);
    }

    private User otherAdmin() {
        Organization organization = new Organization();
        organization.setName("Foreign organization");
        organization.setLegalName("Foreign organization");
        organization.setSiret("38012986600014");
        organization.setEmail("foreign-org@example.test");
        organization = organizations.save(organization);
        User user = new User();
        user.setOrganization(organization);
        user.setRole(admin.getRole());
        user.setFirstName("Foreign");
        user.setLastName("Admin");
        user.setEmail("foreign-audit@example.test");
        user.setPasswordHash("PRIVATE_PASSWORD_HASH");
        user.setActive(true);
        return users.save(user);
    }
}
