package org.facturation.backend.service;

import org.facturation.backend.dto.request.LoginRequest;
import org.facturation.backend.dto.response.LoginResponse;

public interface AuthenticationService {

    LoginResponse login(LoginRequest request);
}
