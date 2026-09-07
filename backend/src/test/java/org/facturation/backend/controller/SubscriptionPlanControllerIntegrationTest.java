package org.facturation.backend.controller;

import org.facturation.backend.model.SubscriptionPlan;
import org.facturation.backend.repository.SubscriptionPlanRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    private UserRepository userRepository;

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
    void unauthenticatedUserCannotListPlans() throws Exception {
        mockMvc.perform(get("/api/v1/subscription-plans"))
                .andExpect(status().isUnauthorized());
    }

    private String adminToken() {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow()
        );
    }
}
