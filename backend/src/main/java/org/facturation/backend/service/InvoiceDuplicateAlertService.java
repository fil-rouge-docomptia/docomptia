package org.facturation.backend.service;

import org.facturation.backend.dto.response.InvoiceDuplicateAlertResponse;
import org.facturation.backend.model.Invoice;

import java.util.List;

public interface InvoiceDuplicateAlertService {

    void detectDuplicates(Invoice invoice);

    List<InvoiceDuplicateAlertResponse> findByInvoiceId(Long invoiceId);
}
