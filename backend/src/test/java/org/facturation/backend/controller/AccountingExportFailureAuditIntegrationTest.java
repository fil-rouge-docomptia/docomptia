package org.facturation.backend.controller;

import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AccountingExportFailureAuditIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private UserRepository userRepository;

    @Test
    void recordsFailedExportAfterTheExportTransactionRollsBack() throws Exception {
        User user = userRepository.findById(1L).orElseThrow();

        mockMvc.perform(post("/api/v1/accounting-exports/csv")
                        .param("startDate", "2026-01-01")
                        .param("endDate", "2026-01-31")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwtTokenService.generate(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("No exportable invoices found; invoices already exported cannot be exported again"));

        List<AuditLog> exportLogs = auditLogRepository.findAll().stream()
                .filter(log -> "AccountingCsvExport".equals(log.getEntityName()))
                .filter(log -> "CSV_EXPORT".equals(log.getAction()))
                .toList();

        assertThat(exportLogs).singleElement().satisfies(log -> {
            assertThat(log.getEntityId()).isEqualTo(user.getUserId());
            assertThat(log.getUser().getUserId()).isEqualTo(user.getUserId());
            assertThat(log.getCreatedAt()).isNotNull();
            assertThat(log.getOldValue()).contains(
                    "format=CSV",
                    "periodStartDate=" + LocalDate.of(2026, 1, 1),
                    "periodEndDate=" + LocalDate.of(2026, 1, 31),
                    "invoiceIds=[]"
            );
            assertThat(log.getNewValue()).contains(
                    "result=FAILURE",
                    "reason=No exportable invoices found; invoices already exported cannot be exported again"
            );
        });
    }
}
