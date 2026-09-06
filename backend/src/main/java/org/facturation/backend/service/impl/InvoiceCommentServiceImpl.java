package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.InvoiceCommentRequest;
import org.facturation.backend.dto.response.InvoiceCommentResponse;
import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.mapper.InvoiceCommentResponseMapper;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceComment;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.InvoiceCommentRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.facturation.backend.service.CurrentUserService;
import org.facturation.backend.service.InvoiceCommentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class InvoiceCommentServiceImpl implements InvoiceCommentService {

    private final InvoiceCommentRepository commentRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceCommentResponseMapper responseMapper;
    private final CurrentUserService currentUserService;

    public InvoiceCommentServiceImpl(
            InvoiceCommentRepository commentRepository,
            InvoiceRepository invoiceRepository,
            InvoiceCommentResponseMapper responseMapper,
            CurrentUserService currentUserService
    ) {
        this.commentRepository = commentRepository;
        this.invoiceRepository = invoiceRepository;
        this.responseMapper = responseMapper;
        this.currentUserService = currentUserService;
    }

    @Override
    @Transactional
    public InvoiceCommentResponse addComment(Long invoiceId, InvoiceCommentRequest request) {
        String content = requireContent(request);
        User author = currentUserService.getCurrentUser();
        Long organizationId = author.getOrganization().getOrganizationId();
        Invoice invoice = invoiceRepository
                .findByInvoiceIdAndOrganizationOrganizationId(invoiceId, organizationId)
                .orElseThrow(() -> new InvoiceNotFoundException(invoiceId));

        InvoiceComment comment = new InvoiceComment();
        comment.setInvoice(invoice);
        comment.setAuthor(author);
        comment.setContent(content);
        comment.setCreatedAt(LocalDateTime.now());
        return responseMapper.toResponse(commentRepository.save(comment));
    }

    private String requireContent(InvoiceCommentRequest request) {
        if (request == null || request.getContent() == null || request.getContent().isBlank()) {
            throw new IllegalArgumentException("Comment content is required");
        }
        return request.getContent().trim();
    }
}
