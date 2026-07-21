package org.facturation.backend.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "API Facturation Electronique",
                version = "v1",
                description = "API du MVP de gestion et de traitement des factures"
        )
)
public class OpenApiConfig {
}
