package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceValidationDecisionType;
import org.facturation.backend.model.User;

public interface InvoiceValidationDecisionService {

    void record(Invoice invoice, InvoiceValidationDecisionType decisionType, User user, String reason);
}
