package org.facturation.backend.repository;

import org.facturation.backend.model.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.List;
import java.util.Optional;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {

    List<SubscriptionPlan> findByActiveTrueOrderBySubscriptionPlanId();

    @EntityGraph(attributePaths = {"features", "limits"})
    Optional<SubscriptionPlan> findByCodeIgnoreCaseAndActiveTrue(String code);
}
