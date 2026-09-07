package org.facturation.backend.service;

import org.facturation.backend.dto.request.CustomerCreateRequest;
import org.facturation.backend.dto.request.CustomerUpdateRequest;
import org.facturation.backend.dto.response.CustomerResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomerService {

    Page<CustomerResponse> findPage(Pageable pageable);

    CustomerResponse findDetailsById(Long id);

    CustomerResponse create(CustomerCreateRequest request);

    CustomerResponse update(Long id, CustomerUpdateRequest request);

    CustomerResponse deactivate(Long id);
}
