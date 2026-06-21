package org.facturation.backend.config;

import jakarta.servlet.Servlet;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class H2ConsoleConfig {

    @Bean
    public ServletRegistrationBean<Servlet> h2ConsoleServlet() {
        ServletRegistrationBean<Servlet> registration =
                new ServletRegistrationBean<>(createH2Servlet(), "/h2-console/*");

        registration.addInitParameter("-webAllowOthers", "false");
        return registration;
    }

    private Servlet createH2Servlet() {
        try {
            Class<?> servletClass = Class.forName("org.h2.server.web.JakartaWebServlet");
            return (Servlet) servletClass.getDeclaredConstructor().newInstance();
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to initialize H2 console servlet", exception);
        }
    }
}
