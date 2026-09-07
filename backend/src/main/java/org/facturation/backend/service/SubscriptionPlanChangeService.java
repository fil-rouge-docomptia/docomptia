package org.facturation.backend.service;

import org.facturation.backend.dto.request.SubscriptionPlanChangeRequest;
import org.facturation.backend.dto.response.SubscriptionPlanChangeResponse;

public interface SubscriptionPlanChangeService {

    SubscriptionPlanChangeResponse changeCurrentPlan(SubscriptionPlanChangeRequest request);
}
