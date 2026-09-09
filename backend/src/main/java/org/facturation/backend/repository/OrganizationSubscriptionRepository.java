package org.facturation.backend.repository;

import org.facturation.backend.model.OrganizationSubscription;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface OrganizationSubscriptionRepository extends JpaRepository<OrganizationSubscription, Long> {

    @EntityGraph(attributePaths = {"plan", "plan.features", "plan.limits"})
    @Query("""
            select subscription from OrganizationSubscription subscription
            where subscription.organization.organizationId = :organizationId
              and subscription.startDate <= :date
              and (subscription.endDate is null or subscription.endDate >= :date)
            order by subscription.startDate desc, subscription.organizationSubscriptionId desc
            """)
    Optional<OrganizationSubscription> findCurrentAt(
            @Param("organizationId") Long organizationId,
            @Param("date") LocalDate date
    );

    default Optional<OrganizationSubscription> findByOrganizationOrganizationId(Long organizationId) {
        return findCurrentAt(organizationId, LocalDate.now());
    }

    boolean existsByOrganizationOrganizationIdAndStartDateGreaterThan(Long organizationId, LocalDate date);

    @EntityGraph(attributePaths = {"plan", "plan.features", "plan.limits"})
    List<OrganizationSubscription> findByOrganizationOrganizationIdOrderByStartDateAscOrganizationSubscriptionIdAsc(
            Long organizationId
    );
}
