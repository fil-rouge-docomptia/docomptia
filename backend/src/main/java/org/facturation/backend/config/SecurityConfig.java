package org.facturation.backend.config;

import org.facturation.backend.security.ApiAccessDeniedHandler;
import org.facturation.backend.security.ApiAuthenticationEntryPoint;
import org.facturation.backend.security.BusinessPermission;
import org.facturation.backend.security.JwtAuthenticationFilter;
import org.facturation.backend.model.RoleCode;
import org.facturation.backend.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.config.http.SessionCreationPolicy;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    UserDetailsService userDetailsService(UserRepository userRepository) {
        return email -> userRepository.findByEmailIgnoreCase(email)
                .map(user -> User.withUsername(user.getEmail())
                        .password(user.getPasswordHash())
                        .roles(RoleCode.fromCode(user.getRole().getCode()).getCode())
                        .disabled(!user.isActive())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            ApiAuthenticationEntryPoint authenticationEntryPoint,
            ApiAccessDeniedHandler accessDeniedHandler,
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/api/hello",
                                "/api/v1/auth/login",
                                "/api/v1/auth/register",
                                "/v3/api-docs/**",
                        "/swagger-ui.html",
                        "/swagger-ui/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/me")
                        .hasAnyRole(BusinessPermission.VIEW_OWN_PROFILE.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/reference-data")
                        .hasAnyRole(BusinessPermission.VIEW_REFERENCE_DATA.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current")
                        .hasAnyRole(BusinessPermission.VIEW_ORGANIZATION.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current/onboarding")
                        .hasAnyRole(BusinessPermission.MANAGE_ORGANIZATION.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current/validation-preferences")
                        .hasAnyRole(BusinessPermission.VIEW_ORGANIZATION.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/organizations/current/validation-preferences")
                        .hasAnyRole(BusinessPermission.MANAGE_ORGANIZATION.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/organizations/current")
                        .hasAnyRole(BusinessPermission.MANAGE_ORGANIZATION.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/dashboard/summary")
                        .hasAnyRole(BusinessPermission.VIEW_DASHBOARD.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/notifications")
                        .hasAnyRole(BusinessPermission.VIEW_NOTIFICATIONS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/notifications/*/read")
                        .hasAnyRole(BusinessPermission.VIEW_NOTIFICATIONS.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/invoices/pending-validation")
                        .hasAnyRole(BusinessPermission.VALIDATE_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/invoices", "/api/v1/invoices/**")
                        .hasAnyRole(BusinessPermission.VIEW_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/comments")
                        .hasAnyRole(BusinessPermission.COMMENT_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/invoices/*/validate",
                                "/api/v1/invoices/*/request-correction",
                                "/api/v1/invoices/*/reject"
                        )
                        .hasAnyRole(BusinessPermission.VALIDATE_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/accounting-entry")
                        .hasAnyRole(BusinessPermission.MANAGE_ACCOUNTING_ENTRIES.roleCodes())
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/accounting-entries/*/reversal",
                                "/api/v1/accounting-entries/*/corrective-entry"
                        )
                        .hasAnyRole(BusinessPermission.MANAGE_ACCOUNTING_ENTRIES.roleCodes())
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/accounting-exports/csv",
                                "/api/v1/accounting-exports/fec",
                                "/api/v1/accounting-exports/*/archive"
                        )
                        .hasAnyRole(BusinessPermission.EXPORT_ACCOUNTING.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/accounting-exports/*/file")
                        .hasAnyRole(BusinessPermission.EXPORT_ACCOUNTING.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/mark-paid")
                        .hasAnyRole(BusinessPermission.CONFIRM_INVOICE_PAYMENTS.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/archive")
                        .hasAnyRole(BusinessPermission.ARCHIVE_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/accounting-entries/**")
                        .hasAnyRole(BusinessPermission.MANAGE_ACCOUNTING_ENTRIES.roleCodes())
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/invoices/upload",
                                "/api/v1/invoices/*/ocr/retry",
                                "/api/v1/invoices/*/submit-for-validation",
                                "/api/v1/invoices/*/duplicate-alerts/*/decision"
                        )
                        .hasAnyRole(BusinessPermission.PROCESS_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*")
                        .hasAnyRole(BusinessPermission.PROCESS_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*/classification")
                        .hasAnyRole(BusinessPermission.PROCESS_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*/assignee")
                        .hasAnyRole(BusinessPermission.PROCESS_INVOICES.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/suppliers", "/api/v1/suppliers/**")
                        .hasAnyRole(BusinessPermission.VIEW_SUPPLIERS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/suppliers/*")
                        .hasAnyRole(BusinessPermission.MANAGE_SUPPLIERS.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/customers", "/api/v1/customers/**")
                        .hasAnyRole(BusinessPermission.VIEW_CUSTOMERS.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/customers", "/api/v1/customers/*/deactivate")
                        .hasAnyRole(BusinessPermission.MANAGE_CUSTOMERS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/customers/*")
                        .hasAnyRole(BusinessPermission.MANAGE_CUSTOMERS.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/chart-of-accounts", "/api/v1/chart-of-accounts/**")
                        .hasAnyRole(BusinessPermission.VIEW_ACCOUNTING_CONFIGURATION.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/accounting-rules", "/api/v1/accounting-rules/**")
                        .hasAnyRole(BusinessPermission.VIEW_ACCOUNTING_CONFIGURATION.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/chart-of-accounts", "/api/v1/chart-of-accounts/*/deactivate")
                        .hasAnyRole(BusinessPermission.MANAGE_ACCOUNTING_CONFIGURATION.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/chart-of-accounts/**", "/api/v1/accounting-rules/**")
                        .hasAnyRole(BusinessPermission.MANAGE_ACCOUNTING_CONFIGURATION.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/classifications", "/api/v1/classifications/**")
                        .hasAnyRole(BusinessPermission.VIEW_CLASSIFICATIONS.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/classifications", "/api/v1/classifications/*/deactivate")
                        .hasAnyRole(BusinessPermission.MANAGE_CLASSIFICATIONS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/classifications/*")
                        .hasAnyRole(BusinessPermission.MANAGE_CLASSIFICATIONS.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/users")
                        .hasAnyRole(BusinessPermission.MANAGE_USERS.roleCodes())
                        .requestMatchers(HttpMethod.GET, "/api/v1/roles")
                        .hasAnyRole(BusinessPermission.MANAGE_USERS.roleCodes())
                        .requestMatchers(HttpMethod.POST, "/api/v1/users")
                        .hasAnyRole(BusinessPermission.MANAGE_USERS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*")
                        .hasAnyRole(BusinessPermission.MANAGE_USERS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/status")
                        .hasAnyRole(BusinessPermission.MANAGE_USERS.roleCodes())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/role")
                        .hasAnyRole(BusinessPermission.MANAGE_USERS.roleCodes())
                        .anyRequest().denyAll()
                )
                .httpBasic(AbstractHttpConfigurer::disable)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .build();
    }
}
