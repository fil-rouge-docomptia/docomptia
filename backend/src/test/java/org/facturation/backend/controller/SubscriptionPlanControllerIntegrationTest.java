package org.facturation.backend.controller;

import jakarta.persistence.EntityManager;
import org.facturation.backend.model.OrganizationSubscription;
import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.SubscriptionPlanLimit;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.repository.InvoiceStatusRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.facturation.backend.repository.SubscriptionPlanRepository;
import org.facturation.backend.repository.OrganizationSubscriptionRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SubscriptionPlanControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SubscriptionPlanRepository subscriptionPlanRepository;

    @Autowired
    private OrganizationSubscriptionRepository organizationSubscriptionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private InvoiceRepository invoiceRepository;

    @Autowired
    private InvoiceStatusRepository invoiceStatusRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private EntityManager entityManager;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void authenticatedUserListsActivePlansWithLimitsAndFeatures() throws Exception {
        mockMvc.perform(get("/api/v1/subscription-plans")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].code").value("STARTER"))
                .andExpect(jsonPath("$[0].name").value("Starter"))
                .andExpect(jsonPath("$[0].maxActiveUsers").value(2))
                .andExpect(jsonPath("$[0].monthlyInvoiceLimit").value(100))
                .andExpect(jsonPath("$[0].features.length()").value(3))
                .andExpect(jsonPath("$[0].features[0]").value("INVOICE_MANAGEMENT"))
                .andExpect(jsonPath("$[1].code").value("BUSINESS"))
                .andExpect(jsonPath("$[1].maxActiveUsers").value(10))
                .andExpect(jsonPath("$[1].monthlyInvoiceLimit").value(1000))
                .andExpect(jsonPath("$[1].features[4]").value("AUDIT_LOG"))
                .andExpect(jsonPath("$[2].code").value("PRO"))
                .andExpect(jsonPath("$[2].maxActiveUsers").isEmpty())
                .andExpect(jsonPath("$[2].monthlyInvoiceLimit").isEmpty())
                .andExpect(jsonPath("$[2].features[6]").value("ADVANCED_CONNECTORS"))
                .andExpect(jsonPath("$[0].subscriptionPlanId").doesNotExist())
                .andExpect(jsonPath("$[0].active").doesNotExist());
    }

    @Test
    void inactivePlanIsKeptButExcludedFromTheCatalog() throws Exception {
        SubscriptionPlan business = subscriptionPlanRepository.findAll().stream()
                .filter(plan -> plan.getCode().equals("BUSINESS"))
                .findFirst()
                .orElseThrow();
        business.setActive(false);
        subscriptionPlanRepository.saveAndFlush(business);

        mockMvc.perform(get("/api/v1/subscription-plans")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.code == 'BUSINESS')]").isEmpty());
    }

    @Test
    void aNewLimitPeriodDoesNotChangePastPeriods() {
        SubscriptionPlan starter = subscriptionPlanRepository.findAll().stream()
                .filter(plan -> plan.getCode().equals("STARTER"))
                .findFirst()
                .orElseThrow();

        SubscriptionPlanLimit futureLimits = new SubscriptionPlanLimit();
        futureLimits.setPlan(starter);
        futureLimits.setValidFrom(LocalDate.of(2026, 10, 1));
        futureLimits.setMaxActiveUsers(3);
        futureLimits.setMonthlyInvoiceLimit(150);
        entityManager.persist(futureLimits);
        entityManager.flush();
        entityManager.clear();

        SubscriptionPlan reloadedStarter = subscriptionPlanRepository.findById(starter.getSubscriptionPlanId()).orElseThrow();

        assertThat(reloadedStarter.findLimitsAt(LocalDate.of(2026, 9, 30)).orElseThrow().getMonthlyInvoiceLimit())
                .isEqualTo(100);
        assertThat(reloadedStarter.findLimitsAt(LocalDate.of(2026, 10, 1)).orElseThrow().getMonthlyInvoiceLimit())
                .isEqualTo(150);
    }

    @Test
    void unauthenticatedUserCannotListPlans() throws Exception {
        mockMvc.perform(get("/api/v1/subscription-plans"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminGetsCurrentOrganizationSubscriptionWithPlanDetails() throws Exception {
        User admin = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        YearMonth currentMonth = YearMonth.now();
        long activeUsersBeforeTest = userRepository.countByOrganizationOrganizationIdAndIsActiveTrue(
                admin.getOrganization().getOrganizationId()
        );
        long monthlyInvoicesBeforeTest = invoiceRepository
                .countByOrganizationOrganizationIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
                        admin.getOrganization().getOrganizationId(),
                        currentMonth.atDay(1).atStartOfDay(),
                        currentMonth.plusMonths(1).atDay(1).atStartOfDay()
                );
        createInvoice(admin, currentMonth.atDay(1).atStartOfDay());
        createInvoice(admin, currentMonth.minusMonths(1).atEndOfMonth().atTime(23, 59));
        createInvoice(createUserInAnotherOrganization(), currentMonth.atDay(1).atStartOfDay());

        mockMvc.perform(get("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(true))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.nextBillingDate").value("2026-10-01"))
                .andExpect(jsonPath("$.plan.code").value("STARTER"))
                .andExpect(jsonPath("$.plan.maxActiveUsers").value(2))
                .andExpect(jsonPath("$.plan.monthlyInvoiceLimit").value(100))
                .andExpect(jsonPath("$.plan.features[0]").value("INVOICE_MANAGEMENT"))
                .andExpect(jsonPath("$.usage.periodStart").value(currentMonth.atDay(1).toString()))
                .andExpect(jsonPath("$.usage.periodEnd").value(currentMonth.atEndOfMonth().toString()))
                .andExpect(jsonPath("$.usage.activeUsers").value(activeUsersBeforeTest))
                .andExpect(jsonPath("$.usage.monthlyInvoices").value(monthlyInvoicesBeforeTest + 1));
    }

    @Test
    void upgradeTakesEffectImmediatelyAndKeepsSubscriptionHistory() throws Exception {
        LocalDate today = LocalDate.now();

        mockMvc.perform(patch("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("{\"planCode\":\"BUSINESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.changeType").value("UPGRADE"))
                .andExpect(jsonPath("$.effectiveDate").value(today.toString()))
                .andExpect(jsonPath("$.plan.code").value("BUSINESS"));

        var history = organizationSubscriptionRepository
                .findByOrganizationOrganizationIdOrderByStartDateAscOrganizationSubscriptionIdAsc(1L);
        assertThat(history).hasSize(2);
        assertThat(history.getFirst().getPlan().getCode()).isEqualTo("STARTER");
        assertThat(history.getFirst().getEndDate()).isEqualTo(today.minusDays(1));
        assertThat(history.getLast().getPlan().getCode()).isEqualTo("BUSINESS");
        assertThat(history.getLast().getStartDate()).isEqualTo(today);
        assertThat(history.getLast().getEndDate()).isNull();
    }

    @Test
    void downgradeTakesEffectAtPeriodEndAndKeepsCurrentPlanUntilThen() throws Exception {
        OrganizationSubscription current = currentSubscription();
        current.setPlan(plan("PRO"));
        organizationSubscriptionRepository.saveAndFlush(current);

        mockMvc.perform(patch("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("{\"planCode\":\"BUSINESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.changeType").value("DOWNGRADE"))
                .andExpect(jsonPath("$.effectiveDate").value("2026-10-01"))
                .andExpect(jsonPath("$.plan.code").value("BUSINESS"));

        assertThat(organizationSubscriptionRepository.findCurrentAt(1L, LocalDate.of(2026, 9, 30)))
                .get().extracting(subscription -> subscription.getPlan().getCode()).isEqualTo("PRO");
        assertThat(organizationSubscriptionRepository.findCurrentAt(1L, LocalDate.of(2026, 10, 1)))
                .get().extracting(subscription -> subscription.getPlan().getCode()).isEqualTo("BUSINESS");
        assertThat(organizationSubscriptionRepository
                .findByOrganizationOrganizationIdOrderByStartDateAscOrganizationSubscriptionIdAsc(1L))
                .hasSize(2);

        mockMvc.perform(get("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.code").value("PRO"));
    }

    @Test
    void downgradeIsRejectedWhenTargetPlanCannotSupportActiveUsers() throws Exception {
        OrganizationSubscription current = currentSubscription();
        current.setPlan(plan("BUSINESS"));
        organizationSubscriptionRepository.saveAndFlush(current);
        createActiveUser("second-subscription-user@example.com");
        createActiveUser("third-subscription-user@example.com");

        mockMvc.perform(patch("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType("application/json")
                        .content("{\"planCode\":\"STARTER\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SUBSCRIPTION_CHANGE_NOT_ALLOWED"));

        assertThat(currentSubscription().getPlan().getCode()).isEqualTo("BUSINESS");
        assertThat(currentSubscription().getEndDate()).isNull();
        assertThat(organizationSubscriptionRepository
                .findByOrganizationOrganizationIdOrderByStartDateAscOrganizationSubscriptionIdAsc(1L))
                .hasSize(1);
    }

    @Test
    void currentSubscriptionExplicitlyReportsNoSubscription() throws Exception {
        organizationSubscriptionRepository.deleteAll();
        organizationSubscriptionRepository.flush();

        mockMvc.perform(get("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(false))
                .andExpect(jsonPath("$.status").isEmpty())
                .andExpect(jsonPath("$.nextBillingDate").isEmpty())
                .andExpect(jsonPath("$.plan").isEmpty())
                .andExpect(jsonPath("$.usage").isEmpty());
    }

    @Test
    void nonAdminCannotGetCurrentSubscription() throws Exception {
        User operator = new User();
        operator.setOrganization(userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow().getOrganization());
        operator.setRole(roleRepository.findByCode("OPERATEUR_COMPTABLE").orElseThrow());
        operator.setFirstName("Test");
        operator.setLastName("Operator");
        operator.setEmail("operator-subscription-test@example.com");
        operator.setPasswordHash("not-used");
        operator.setActive(true);
        userRepository.saveAndFlush(operator);

        mockMvc.perform(get("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + tokenFor(operator.getEmail())))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/organizations/current/subscription")
                        .header("Authorization", "Bearer " + tokenFor(operator.getEmail()))
                        .contentType("application/json")
                        .content("{\"planCode\":\"BUSINESS\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private String adminToken() {
        return tokenFor("admin@facturation-demo.fr");
    }

    private OrganizationSubscription currentSubscription() {
        return organizationSubscriptionRepository.findCurrentAt(1L, LocalDate.now()).orElseThrow();
    }

    private SubscriptionPlan plan(String code) {
        return subscriptionPlanRepository.findByCodeIgnoreCaseAndActiveTrue(code).orElseThrow();
    }

    private User createActiveUser(String email) {
        User user = new User();
        user.setOrganization(userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr")
                .orElseThrow().getOrganization());
        user.setRole(roleRepository.findByCode("OPERATEUR_COMPTABLE").orElseThrow());
        user.setFirstName("Subscription");
        user.setLastName("User");
        user.setEmail(email);
        user.setPasswordHash("not-used");
        user.setActive(true);
        return userRepository.saveAndFlush(user);
    }

    private void createInvoice(User creator, LocalDateTime createdAt) {
        Invoice invoice = new Invoice();
        invoice.setOrganization(creator.getOrganization());
        invoice.setCreatedByUser(creator);
        invoice.setInvoiceStatus(invoiceStatusRepository.findByCode("DEPOSEE").orElseThrow());
        invoice.setCurrencyCode("EUR");
        invoice.setCreatedAt(createdAt);
        invoice.setUpdatedAt(createdAt);
        invoiceRepository.saveAndFlush(invoice);
    }

    private User createUserInAnotherOrganization() {
        LocalDateTime now = LocalDateTime.now();
        Organization organization = new Organization();
        organization.setName("Other organization");
        organization.setLegalName("Other organization SAS");
        organization.setSiret("73282932000074");
        organization.setEmail("other-organization@example.com");
        organization.setCreatedAt(now);
        organization.setUpdatedAt(now);
        organizationRepository.saveAndFlush(organization);

        User user = new User();
        user.setOrganization(organization);
        user.setRole(roleRepository.findByCode("ADMIN").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Admin");
        user.setEmail("other-subscription-admin@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.saveAndFlush(user);
    }

    private String tokenFor(String email) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase(email).orElseThrow()
        );
    }
}
