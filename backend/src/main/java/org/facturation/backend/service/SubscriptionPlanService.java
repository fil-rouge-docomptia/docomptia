package org.facturation.backend.service;

import org.facturation.backend.dto.response.SubscriptionPlanResponse;

import java.util.List;

public interface SubscriptionPlanService {

    List<SubscriptionPlanResponse> findActivePlans();
}
