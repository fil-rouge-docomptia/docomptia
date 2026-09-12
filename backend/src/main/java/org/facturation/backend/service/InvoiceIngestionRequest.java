package org.facturation.backend.service;

import org.facturation.backend.model.InvoiceOrigin;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.springframework.web.multipart.MultipartFile;

public record InvoiceIngestionRequest(
        MultipartFile file,
        Long supplierId,
        Organization organization,
        InvoiceOrigin origin,
        User auditUser
) {
}
