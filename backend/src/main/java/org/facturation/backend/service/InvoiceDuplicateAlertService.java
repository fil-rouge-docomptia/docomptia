package org.facturation.backend.service;

import org.facturation.backend.dto.response.InvoiceDuplicateAlertResponse;
import org.facturation.backend.model.DuplicateAlertDecision;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.User;

import java.util.List;

public interface InvoiceDuplicateAlertService {

    void detectDuplicates(Invoice invoice);

    List<InvoiceDuplicateAlertResponse> findByInvoiceId(Long invoiceId);

    void ensureNoPendingAlerts(Long invoiceId, String action);

    Invoice decide(
            Long invoiceId,
            Long alertId,
            DuplicateAlertDecision decision,
            String reason,
            User user
    );
}
