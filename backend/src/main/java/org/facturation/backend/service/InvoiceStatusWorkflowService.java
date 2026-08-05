package org.facturation.backend.service;

import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatus;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.model.User;

public interface InvoiceStatusWorkflowService {

    InvoiceStatus findByCode(InvoiceStatusCode code);

    InvoiceStatus findByCode(String code);

    void ensureCanTransition(Invoice invoice, InvoiceStatusCode targetCode);

    void transitionTo(Invoice invoice, InvoiceStatusCode targetCode, User user, String comment);

    void recordStatus(Invoice invoice, InvoiceStatus status, User user, String comment);

    void updateStatus(Invoice invoice, InvoiceStatus status, User user, String comment);

    void updateStatusIfChanged(Invoice invoice, InvoiceStatus status, User user, String comment);
}
