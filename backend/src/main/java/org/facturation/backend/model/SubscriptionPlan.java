package org.facturation.backend.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "subscription_plans")
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long subscriptionPlanId;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private Integer maxActiveUsers;

    private Integer monthlyInvoiceLimit;

    @Column(nullable = false)
    private boolean active;

    @ElementCollection
    @CollectionTable(
            name = "subscription_plan_features",
            joinColumns = @JoinColumn(name = "subscription_plan_id")
    )
    @OrderColumn(name = "feature_order")
    @Column(name = "feature_code", nullable = false)
    private List<String> features = new ArrayList<>();

    public Long getSubscriptionPlanId() {
        return subscriptionPlanId;
    }

    public void setSubscriptionPlanId(Long subscriptionPlanId) {
        this.subscriptionPlanId = subscriptionPlanId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getMaxActiveUsers() {
        return maxActiveUsers;
    }

    public void setMaxActiveUsers(Integer maxActiveUsers) {
        this.maxActiveUsers = maxActiveUsers;
    }

    public Integer getMonthlyInvoiceLimit() {
        return monthlyInvoiceLimit;
    }

    public void setMonthlyInvoiceLimit(Integer monthlyInvoiceLimit) {
        this.monthlyInvoiceLimit = monthlyInvoiceLimit;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public List<String> getFeatures() {
        return features;
    }

    public void setFeatures(List<String> features) {
        this.features = features;
    }
}
