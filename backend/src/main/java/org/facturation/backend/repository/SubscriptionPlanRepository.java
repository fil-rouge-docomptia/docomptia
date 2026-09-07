package org.facturation.backend.repository;

import org.facturation.backend.model.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {

    List<SubscriptionPlan> findByActiveTrueOrderBySubscriptionPlanId();
}
