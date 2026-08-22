package org.facturation.backend.service.impl;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceValidationDecision;
import org.facturation.backend.model.InvoiceValidationDecisionType;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceValidationDecisionRepository;
import org.facturation.backend.service.InvoiceValidationDecisionService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class InvoiceValidationDecisionServiceImpl implements InvoiceValidationDecisionService {

    private final InvoiceValidationDecisionRepository repository;

    public InvoiceValidationDecisionServiceImpl(InvoiceValidationDecisionRepository repository) {
        this.repository = repository;
    }

    @Override
    public void record(Invoice invoice, InvoiceValidationDecisionType decisionType, User user, String reason) {
        InvoiceValidationDecision decision = new InvoiceValidationDecision();
        decision.setInvoice(invoice);
        decision.setDecisionType(decisionType);
        decision.setDecidedByUser(user);
        decision.setDecidedAt(LocalDateTime.now());
        decision.setReason(reason);
        repository.save(decision);
    }
}
