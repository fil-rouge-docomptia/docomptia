package org.facturation.backend.repository;

import org.facturation.backend.model.OrganizationSubscription;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrganizationSubscriptionRepository extends JpaRepository<OrganizationSubscription, Long> {

    @EntityGraph(attributePaths = {"plan", "plan.features"})
    Optional<OrganizationSubscription> findByOrganizationOrganizationId(Long organizationId);
}
