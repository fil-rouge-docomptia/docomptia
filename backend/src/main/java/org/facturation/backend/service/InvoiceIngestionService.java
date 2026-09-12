package org.facturation.backend.service;

public interface InvoiceIngestionService {

    InvoiceIngestionResult ingest(InvoiceIngestionRequest request);
}
