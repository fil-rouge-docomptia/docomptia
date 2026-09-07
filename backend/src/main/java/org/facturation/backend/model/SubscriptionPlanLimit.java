package org.facturation.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

@Entity
@Table(
        name = "subscription_plan_limits",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_subscription_plan_limits_period",
                columnNames = {"subscription_plan_id", "valid_from"}
        )
)
public class SubscriptionPlanLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long subscriptionPlanLimitId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "subscription_plan_id", nullable = false)
    private SubscriptionPlan plan;

    @Column(nullable = false)
    private LocalDate validFrom;

    private LocalDate validTo;

    private Integer maxActiveUsers;

    private Integer monthlyInvoiceLimit;

    public Long getSubscriptionPlanLimitId() {
        return subscriptionPlanLimitId;
    }

    public SubscriptionPlan getPlan() {
        return plan;
    }

    public void setPlan(SubscriptionPlan plan) {
        this.plan = plan;
    }

    public LocalDate getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(LocalDate validFrom) {
        this.validFrom = validFrom;
    }

    public LocalDate getValidTo() {
        return validTo;
    }

    public void setValidTo(LocalDate validTo) {
        this.validTo = validTo;
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
}
