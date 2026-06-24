package org.facturation.backend.service.storage;

import org.springframework.web.multipart.MultipartFile;

public interface InvoiceFileStorageService {

    StoredInvoiceFile store(MultipartFile file, Long invoiceId);
}
