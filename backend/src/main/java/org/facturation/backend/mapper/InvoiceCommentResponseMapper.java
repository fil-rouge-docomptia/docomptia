package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.InvoiceCommentResponse;
import org.facturation.backend.model.InvoiceComment;
import org.facturation.backend.model.User;
import org.springframework.stereotype.Component;

@Component
public class InvoiceCommentResponseMapper {

    public InvoiceCommentResponse toResponse(InvoiceComment comment) {
        User author = comment.getAuthor();
        InvoiceCommentResponse response = new InvoiceCommentResponse();
        response.setCommentId(comment.getInvoiceCommentId());
        response.setInvoiceId(comment.getInvoice().getInvoiceId());
        response.setContent(comment.getContent());
        response.setAuthorId(author.getUserId());
        response.setAuthor((author.getFirstName() + " " + author.getLastName()).trim());
        response.setCreatedAt(comment.getCreatedAt());
        return response;
    }
}
