package org.facturation.backend.repository;

import org.facturation.backend.model.OrganizationSubscription;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationSubscriptionRepository extends JpaRepository<OrganizationSubscription, Long> {

    @EntityGraph(attributePaths = {"plan", "plan.features"})
    Optional<OrganizationSubscription>
    findFirstByOrganizationOrganizationIdAndEndDateIsNullOrderByStartDateDescOrganizationSubscriptionIdDesc(
            Long organizationId
    );

    List<OrganizationSubscription> findByOrganizationOrganizationIdOrderByStartDateAsc(Long organizationId);
}
