package org.facturation.backend.config;

import org.facturation.backend.security.ApiAccessDeniedHandler;
import org.facturation.backend.security.ApiAuthenticationEntryPoint;
import org.facturation.backend.security.BusinessPermission;
import org.facturation.backend.security.JwtAuthenticationFilter;
import org.facturation.backend.security.PermissionAuthority;
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
                        .authorities(PermissionAuthority.authorities(user))
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
                        .hasAuthority(authority(BusinessPermission.USER_PROFILE_READ))
                        .requestMatchers(HttpMethod.GET, "/api/v1/reference-data")
                        .hasAuthority(authority(BusinessPermission.REFERENCE_DATA_READ))
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current")
                        .hasAuthority(authority(BusinessPermission.ORGANIZATION_READ))
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current/onboarding")
                        .hasAuthority(authority(BusinessPermission.ORGANIZATION_MANAGE))
                        .requestMatchers(HttpMethod.GET, "/api/v1/organizations/current/validation-preferences")
                        .hasAuthority(authority(BusinessPermission.ORGANIZATION_READ))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/organizations/current/validation-preferences")
                        .hasAuthority(authority(BusinessPermission.ORGANIZATION_MANAGE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/organizations/current")
                        .hasAuthority(authority(BusinessPermission.ORGANIZATION_MANAGE))
                        .requestMatchers(HttpMethod.GET, "/api/v1/dashboard/summary")
                        .hasAuthority(authority(BusinessPermission.DASHBOARD_READ))
                        .requestMatchers(HttpMethod.GET, "/api/v1/invoices/pending-validation")
                        .hasAuthority(authority(BusinessPermission.INVOICE_APPROVE))
                        .requestMatchers(HttpMethod.GET, "/api/v1/invoices", "/api/v1/invoices/**")
                        .hasAuthority(authority(BusinessPermission.INVOICE_READ))
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/invoices/*/validate",
                                "/api/v1/invoices/*/request-correction",
                                "/api/v1/invoices/*/reject"
                        )
                        .hasAuthority(authority(BusinessPermission.INVOICE_APPROVE))
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/accounting-entry")
                        .hasAuthority(authority(BusinessPermission.INVOICE_ACCOUNTING_GENERATE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/accounting-entries/**")
                        .hasAuthority(authority(BusinessPermission.ACCOUNTING_ENTRY_UPDATE))
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/upload")
                        .hasAuthority(authority(BusinessPermission.INVOICE_UPLOAD))
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/ocr/retry")
                        .hasAuthority(authority(BusinessPermission.INVOICE_RETRY_OCR))
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/submit-for-validation")
                        .hasAuthority(authority(BusinessPermission.INVOICE_SUBMIT_FOR_VALIDATION))
                        .requestMatchers(HttpMethod.POST, "/api/v1/invoices/*/duplicate-alerts/*/decision")
                        .hasAuthority(authority(BusinessPermission.INVOICE_REVIEW_DUPLICATE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*")
                        .hasAuthority(authority(BusinessPermission.INVOICE_CORRECT))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*/classification")
                        .hasAuthority(authority(BusinessPermission.INVOICE_CLASSIFY))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/invoices/*/assignee")
                        .hasAuthority(authority(BusinessPermission.INVOICE_ASSIGN))
                        .requestMatchers(HttpMethod.GET, "/api/v1/suppliers", "/api/v1/suppliers/**")
                        .hasAuthority(authority(BusinessPermission.SUPPLIER_READ))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/suppliers/*")
                        .hasAuthority(authority(BusinessPermission.SUPPLIER_MANAGE))
                        .requestMatchers(HttpMethod.GET, "/api/v1/chart-of-accounts", "/api/v1/chart-of-accounts/**")
                        .hasAuthority(authority(BusinessPermission.ACCOUNTING_CONFIGURATION_READ))
                        .requestMatchers(HttpMethod.GET, "/api/v1/accounting-rules", "/api/v1/accounting-rules/**")
                        .hasAuthority(authority(BusinessPermission.ACCOUNTING_CONFIGURATION_READ))
                        .requestMatchers(HttpMethod.POST, "/api/v1/chart-of-accounts", "/api/v1/chart-of-accounts/*/deactivate")
                        .hasAuthority(authority(BusinessPermission.ACCOUNTING_CONFIGURATION_MANAGE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/chart-of-accounts/**", "/api/v1/accounting-rules/**")
                        .hasAuthority(authority(BusinessPermission.ACCOUNTING_CONFIGURATION_MANAGE))
                        .requestMatchers(HttpMethod.GET, "/api/v1/classifications", "/api/v1/classifications/**")
                        .hasAuthority(authority(BusinessPermission.CLASSIFICATION_READ))
                        .requestMatchers(HttpMethod.POST, "/api/v1/classifications", "/api/v1/classifications/*/deactivate")
                        .hasAuthority(authority(BusinessPermission.CLASSIFICATION_MANAGE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/classifications/*")
                        .hasAuthority(authority(BusinessPermission.CLASSIFICATION_MANAGE))
                        .requestMatchers(HttpMethod.GET, "/api/v1/users")
                        .hasAuthority(authority(BusinessPermission.MEMBER_READ))
                        .requestMatchers(HttpMethod.GET, "/api/v1/roles")
                        .hasAuthority(authority(BusinessPermission.ROLE_READ))
                        .requestMatchers(HttpMethod.POST, "/api/v1/users")
                        .hasAuthority(authority(BusinessPermission.MEMBER_INVITE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*")
                        .hasAuthority(authority(BusinessPermission.MEMBER_UPDATE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/status")
                        .hasAuthority(authority(BusinessPermission.MEMBER_STATUS_UPDATE))
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/users/*/role")
                        .hasAuthority(authority(BusinessPermission.MEMBER_ROLE_UPDATE))
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

    private static String authority(BusinessPermission permission) {
        return permission.authority();
    }
}
