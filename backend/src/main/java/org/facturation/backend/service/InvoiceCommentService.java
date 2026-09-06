package org.facturation.backend.service;

import org.facturation.backend.dto.request.InvoiceCommentRequest;
import org.facturation.backend.dto.response.InvoiceCommentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface InvoiceCommentService {

    Page<InvoiceCommentResponse> getComments(Long invoiceId, Pageable pageable);

    InvoiceCommentResponse addComment(Long invoiceId, InvoiceCommentRequest request);
}
