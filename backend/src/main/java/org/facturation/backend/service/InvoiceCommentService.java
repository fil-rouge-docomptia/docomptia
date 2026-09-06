package org.facturation.backend.service;

import org.facturation.backend.dto.request.InvoiceCommentRequest;
import org.facturation.backend.dto.response.InvoiceCommentResponse;

public interface InvoiceCommentService {

    InvoiceCommentResponse addComment(Long invoiceId, InvoiceCommentRequest request);
}
