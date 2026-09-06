package org.facturation.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BusinessPermissionTest {

    @Test
    void exposesStablePermissionCodesWithoutEmbeddingRoles() {
        assertThat(BusinessPermission.VIEW_INVOICES.getCode()).isEqualTo("invoice.read");
        assertThat(BusinessPermission.VALIDATE_INVOICES.getCode()).isEqualTo("invoice.approve");
        assertThat(BusinessPermission.values()).allSatisfy(permission ->
                assertThat(permission.getCode()).matches("[a-z][a-z-]*\\.[a-z][a-z-]*"));
    }

    @Test
    void exposesPermissionAuthoritiesExpectedBySpringSecurity() {
        assertThat(BusinessPermission.VALIDATE_INVOICES.authorities())
                .containsExactly("PERMISSION_invoice.approve");
    }
}
