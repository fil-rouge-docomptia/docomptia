package org.facturation.backend.dto.request;

import java.util.List;

public class UserRoleUpdateRequest {

    private String roleCode;
    private List<String> roleCodes;

    public String getRoleCode() {
        return roleCode;
    }

    public void setRoleCode(String roleCode) {
        this.roleCode = roleCode;
    }

    public List<String> getRoleCodes() {
        return roleCodes;
    }

    public void setRoleCodes(List<String> roleCodes) {
        this.roleCodes = roleCodes;
    }
}
