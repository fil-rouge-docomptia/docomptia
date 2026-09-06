package org.facturation.backend.controller;

import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Sql(statements = "INSERT INTO users (user_id, organization_id, role_id, first_name, last_name, email, "
        + "password_hash, is_active, created_at, updated_at) VALUES (9680, 1, 2, 'Test', 'Operator', "
        + "'reference-operator@example.com', 'not-returned', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
class ReferenceDataControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void authenticatedUserListsBackendReferenceDataWithCodesAndLabelsOnly() throws Exception {
        mockMvc.perform(get("/api/v1/reference-data")
                .header("Authorization", "Bearer " + tokenFor("reference-operator@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceStatuses.length()").value(InvoiceStatusCode.values().length))
                .andExpect(jsonPath("$.invoiceStatuses[0].code").value("DEPOSEE"))
                .andExpect(jsonPath("$.invoiceStatuses[0].label").value("Deposee"))
                .andExpect(jsonPath("$.invoiceStatuses[?(@.code == 'PAYEE')].label").value("Payee"))
                .andExpect(jsonPath("$.invoiceStatuses[0].id").doesNotExist())
                .andExpect(jsonPath("$.invoiceStatuses[0].description").doesNotExist())
                .andExpect(jsonPath("$.roles.length()").value(8))
                .andExpect(jsonPath("$.roles[0].code").value("ADMIN"))
                .andExpect(jsonPath("$.roles[0].label").value("Administrateur"))
                .andExpect(jsonPath("$.roles[?(@.code == 'OWNER')]").isNotEmpty())
                .andExpect(jsonPath("$.roles[?(@.code == 'ACCOUNTANT')]").isNotEmpty())
                .andExpect(jsonPath("$.roles[?(@.code == 'APPROVER')]").isNotEmpty())
                .andExpect(jsonPath("$.roles[?(@.code == 'VIEWER')]").isNotEmpty())
                .andExpect(jsonPath("$.currencies[?(@.code == 'EUR')]").isNotEmpty())
                .andExpect(jsonPath("$.currencies[0].code").isString())
                .andExpect(jsonPath("$.currencies[0].label").isString())
                .andExpect(jsonPath("$.invoiceFileFormats.length()").value(3))
                .andExpect(jsonPath("$.invoiceFileFormats[0].code").value("PDF"))
                .andExpect(jsonPath("$.invoiceFileFormats[0].label").value("PDF"))
                .andExpect(jsonPath("$.invoiceFileFormats[1].code").value("PNG"))
                .andExpect(jsonPath("$.invoiceFileFormats[2].code").value("JPEG"));
    }

    @Test
    void unauthenticatedUserCannotListReferenceData() throws Exception {
        mockMvc.perform(get("/api/v1/reference-data"))
                .andExpect(status().isUnauthorized());
    }

    private String tokenFor(String email) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(
                userRepository.findByEmailIgnoreCase(email).orElseThrow()
        );
    }
}
