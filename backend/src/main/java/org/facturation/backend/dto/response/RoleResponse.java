package org.facturation.backend.dto.response;

import java.util.Set;

public record RoleResponse(String code, String label, Set<String> permissions) {
}
