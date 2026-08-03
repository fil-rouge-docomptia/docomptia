package org.facturation.backend.service.storage;

import org.facturation.backend.model.InvoiceFile;
import org.springframework.web.multipart.MultipartFile;

public interface InvoiceFileStorageService {

    StoredInvoiceFile store(MultipartFile file, Long invoiceId);

    MultipartFile load(InvoiceFile invoiceFile);
}
