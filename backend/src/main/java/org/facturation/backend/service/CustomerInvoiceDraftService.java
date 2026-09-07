package org.facturation.backend.service;

import org.facturation.backend.dto.request.CustomerInvoiceDraftRequest;
import org.facturation.backend.dto.response.CustomerInvoiceDraftResponse;

public interface CustomerInvoiceDraftService {

    CustomerInvoiceDraftResponse create(CustomerInvoiceDraftRequest request);

    CustomerInvoiceDraftResponse update(Long invoiceId, CustomerInvoiceDraftRequest request);
}
