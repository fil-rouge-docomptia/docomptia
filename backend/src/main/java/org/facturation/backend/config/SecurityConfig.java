package org.facturation.backend.config;

import org.facturation.backend.security.ApiAccessDeniedHandler;
import org.facturation.backend.security.ApiAuthenticationEntryPoint;
import org.facturation.backend.security.BusinessPermission;
import org.facturation.backend.security.JwtAuthenticationFilter;
import org.facturation.backend.security.RbacAuthorities;
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
                        .authorities(RbacAuthorities.from(user))
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
                        .hasAnyAuthority(BusinessPermission.VIEW_OWN_PROFILE.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/reference-data")
                        .hasAnyAuthority(BusinessPermission.VIEW_REFERENCE_DATA.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current")
                        .hasAnyAuthority(BusinessPermission.VIEW_ORGANIZATION.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current/onboarding")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ORGANIZATION.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current/validation-preferences")
                        .hasAnyAuthority(BusinessPermission.VIEW_ORGANIZATION.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/organizations/current/validation-preferences")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ORGANIZATION.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/organizations/current")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ORGANIZATION.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/dashboard/summary")
                        .hasAnyAuthority(BusinessPermission.VIEW_DASHBOARD.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/invoices/pending-validation")
                        .hasAnyAuthority(BusinessPermission.VALIDATE_INVOICES.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/notifications")
                        .hasAnyAuthority(BusinessPermission.VIEW_NOTIFICATIONS.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/notifications/*/read")
                        .hasAnyAuthority(BusinessPermission.VIEW_NOTIFICATIONS.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/invoices", "/api/v1/invoices/**")
                        .hasAnyAuthority(BusinessPermission.VIEW_INVOICES.authorities())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/comments")
                        .hasAnyAuthority(BusinessPermission.COMMENT_INVOICES.authorities())
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/invoices/*/validate",
                                "/api/v1/invoices/*/request-correction",
                                "/api/v1/invoices/*/reject"
                        )
                        .hasAnyAuthority(BusinessPermission.VALIDATE_INVOICES.authorities())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/mark-paid")
                        .hasAnyAuthority(BusinessPermission.CONFIRM_INVOICE_PAYMENTS.authorities())
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/accounting-entry")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ACCOUNTING_ENTRIES.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/accounting-entries/**")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ACCOUNTING_ENTRIES.authorities())
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/invoices/upload",
                                "/api/v1/invoices/*/ocr/retry",
                                "/api/v1/invoices/*/submit-for-validation",
                                "/api/v1/invoices/*/duplicate-alerts/*/decision"
                        )
                        .hasAnyAuthority(BusinessPermission.PROCESS_INVOICES.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*")
                        .hasAnyAuthority(BusinessPermission.PROCESS_INVOICES.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*/classification")
                        .hasAnyAuthority(BusinessPermission.PROCESS_INVOICES.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*/assignee")
                        .hasAnyAuthority(BusinessPermission.PROCESS_INVOICES.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/suppliers", "/api/v1/suppliers/**")
                        .hasAnyAuthority(BusinessPermission.VIEW_SUPPLIERS.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/suppliers/*")
                        .hasAnyAuthority(BusinessPermission.MANAGE_SUPPLIERS.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/chart-of-accounts", "/api/v1/chart-of-accounts/**")
                        .hasAnyAuthority(BusinessPermission.VIEW_ACCOUNTING_CONFIGURATION.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/accounting-rules", "/api/v1/accounting-rules/**")
                        .hasAnyAuthority(BusinessPermission.VIEW_ACCOUNTING_CONFIGURATION.authorities())
                        .requestMatchers(HttpMethod.POST, "/api/v1/chart-of-accounts", "/api/v1/chart-of-accounts/*/deactivate")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ACCOUNTING_CONFIGURATION.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/chart-of-accounts/**", "/api/v1/accounting-rules/**")
                        .hasAnyAuthority(BusinessPermission.MANAGE_ACCOUNTING_CONFIGURATION.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/classifications", "/api/v1/classifications/**")
                        .hasAnyAuthority(BusinessPermission.VIEW_CLASSIFICATIONS.authorities())
                        .requestMatchers(HttpMethod.POST, "/api/v1/classifications", "/api/v1/classifications/*/deactivate")
                        .hasAnyAuthority(BusinessPermission.MANAGE_CLASSIFICATIONS.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/classifications/*")
                        .hasAnyAuthority(BusinessPermission.MANAGE_CLASSIFICATIONS.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/users")
                        .hasAnyAuthority(BusinessPermission.MANAGE_USERS.authorities())
                        .requestMatchers(HttpMethod.GET, "/api/v1/roles")
                        .hasAnyAuthority(BusinessPermission.MANAGE_USERS.authorities())
                        .requestMatchers(HttpMethod.POST, "/api/v1/users")
                        .hasAnyAuthority(BusinessPermission.MANAGE_USERS.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*")
                        .hasAnyAuthority(BusinessPermission.MANAGE_USERS.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/status")
                        .hasAnyAuthority(BusinessPermission.MANAGE_USERS.authorities())
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/role")
                        .hasAnyAuthority(BusinessPermission.MANAGE_USERS.authorities())
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
