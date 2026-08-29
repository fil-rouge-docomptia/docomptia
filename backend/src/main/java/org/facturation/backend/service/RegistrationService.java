package org.facturation.backend.service;

import org.facturation.backend.dto.request.RegistrationRequest;
import org.facturation.backend.dto.response.RegistrationResponse;

public interface RegistrationService {

    RegistrationResponse register(RegistrationRequest request);
}
