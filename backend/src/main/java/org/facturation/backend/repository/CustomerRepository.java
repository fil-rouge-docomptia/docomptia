package org.facturation.backend.repository;

import org.facturation.backend.model.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Page<Customer> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);

    Optional<Customer> findByCustomerIdAndOrganizationOrganizationId(Long customerId, Long organizationId);

    boolean existsByOrganizationOrganizationIdAndSiret(Long organizationId, String siret);

    boolean existsByOrganizationOrganizationIdAndSiretAndCustomerIdNot(
            Long organizationId, String siret, Long customerId
    );

    boolean existsByOrganizationOrganizationIdAndVatNumber(Long organizationId, String vatNumber);

    boolean existsByOrganizationOrganizationIdAndVatNumberAndCustomerIdNot(
            Long organizationId, String vatNumber, Long customerId
    );
}
