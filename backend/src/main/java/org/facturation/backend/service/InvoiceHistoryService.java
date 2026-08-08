package org.facturation.backend.service;

import org.facturation.backend.dto.response.InvoiceHistoryItemResponse;

import java.util.List;

public interface InvoiceHistoryService {

    List<InvoiceHistoryItemResponse> findByInvoiceId(Long invoiceId);
}
