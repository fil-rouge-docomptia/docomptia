package org.facturation.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class ApiAccessDeniedHandlerTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();
    private final ApiAccessDeniedHandler handler = new ApiAccessDeniedHandler(jsonMapper);

    @Test
    void authenticatedUserWithoutPermissionReceivesCommonForbiddenError() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(
                new MockHttpServletRequest(),
                response,
                new AccessDeniedException("Insufficient permission")
        );

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(jsonMapper.readTree(response.getContentAsString()))
                .isEqualTo(jsonMapper.readTree("""
                        {"code":"FORBIDDEN","message":"Access is denied"}
                        """));
    }
}
