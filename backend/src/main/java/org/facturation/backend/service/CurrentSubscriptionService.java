package org.facturation.backend.service;

import org.facturation.backend.dto.response.CurrentSubscriptionResponse;

public interface CurrentSubscriptionService {

    CurrentSubscriptionResponse findCurrentSubscription();
}
