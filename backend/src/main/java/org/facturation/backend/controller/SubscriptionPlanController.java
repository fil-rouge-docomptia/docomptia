package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.response.SubscriptionPlanResponse;
import org.facturation.backend.service.SubscriptionPlanService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/subscription-plans")
@Tag(name = "Subscription plans", description = "Consultation des offres SaaS actives")
public class SubscriptionPlanController {

    private final SubscriptionPlanService subscriptionPlanService;

    public SubscriptionPlanController(SubscriptionPlanService subscriptionPlanService) {
        this.subscriptionPlanService = subscriptionPlanService;
    }

    @GetMapping
    @Operation(summary = "Lister les plans d'abonnement actifs")
    public ResponseEntity<List<SubscriptionPlanResponse>> listActivePlans() {
        return ResponseEntity.ok(subscriptionPlanService.findActivePlans());
    }
}
