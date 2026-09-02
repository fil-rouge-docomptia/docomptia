package org.facturation.backend.dto.response;

public record InvoiceAssigneeResponse(
        Long id,
        String firstName,
        String lastName,
        String email
) {
}
