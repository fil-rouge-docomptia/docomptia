package org.facturation.backend.repository;

import jakarta.persistence.LockModeType;
import org.facturation.backend.model.Invoice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    boolean existsByInvoiceIdAndOrganizationOrganizationId(Long invoiceId, Long organizationId);

    @EntityGraph(attributePaths = {"invoiceStatus", "organization", "supplier"})
    Optional<Invoice> findByInvoiceIdAndOrganizationOrganizationId(Long invoiceId, Long organizationId);

    @EntityGraph(attributePaths = {"invoiceStatus", "organization", "supplier"})
    Optional<Invoice> findForOcrRetryByInvoiceIdAndOrganizationOrganizationId(Long invoiceId, Long organizationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Invoice> findForAccountingGenerationByInvoiceIdAndOrganizationOrganizationId(
            Long invoiceId,
            Long organizationId
    );

    List<Invoice> findByOrganizationOrganizationIdAndSupplierSupplierIdAndInvoiceDateAndTotalTtcAndInvoiceIdNot(
            Long organizationId,
            Long supplierId,
            LocalDate invoiceDate,
            BigDecimal totalTtc,
            Long invoiceId
    );

    List<Invoice> findByOrganizationOrganizationIdAndSupplierSupplierIdAndInvoiceNumberAndInvoiceIdNot(
            Long organizationId,
            Long supplierId,
            String invoiceNumber,
            Long invoiceId
    );

    default List<Invoice> findCertainDuplicates(
            Long organizationId,
            Long supplierId,
            String invoiceNumber,
            Long invoiceId
    ) {
        return findByOrganizationOrganizationIdAndSupplierSupplierIdAndInvoiceNumberAndInvoiceIdNot(
                organizationId, supplierId, invoiceNumber, invoiceId
        );
    }

    default List<Invoice> findProbableDuplicates(
            Long organizationId,
            Long supplierId,
            LocalDate invoiceDate,
            BigDecimal totalTtc,
            Long invoiceId
    ) {
        return findByOrganizationOrganizationIdAndSupplierSupplierIdAndInvoiceDateAndTotalTtcAndInvoiceIdNot(
                organizationId, supplierId, invoiceDate, totalTtc, invoiceId
        );
    }
}
