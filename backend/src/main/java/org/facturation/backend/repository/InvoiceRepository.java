package org.facturation.backend.repository;

import jakarta.persistence.LockModeType;
import org.facturation.backend.model.Invoice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {

    interface DashboardStatusAggregate {
        String getStatus();

        long getInvoiceCount();

        BigDecimal getTotalHt();

        BigDecimal getTotalTva();

        BigDecimal getTotalTtc();
    }

    @Query("""
            select i.invoiceStatus.code as status,
                   count(i) as invoiceCount,
                   coalesce(sum(i.totalHt), 0) as totalHt,
                   coalesce(sum(i.totalTva), 0) as totalTva,
                   coalesce(sum(i.totalTtc), 0) as totalTtc
            from Invoice i
            where i.organization.organizationId = :organizationId
              and (:hasStartDate = false or i.invoiceDate >= :startDate)
              and (:hasEndDate = false or i.invoiceDate <= :endDate)
            group by i.invoiceStatus.code
            order by i.invoiceStatus.code
            """)
    List<DashboardStatusAggregate> aggregateDashboardByStatus(
            @Param("organizationId") Long organizationId,
            @Param("hasStartDate") boolean hasStartDate,
            @Param("startDate") LocalDate startDate,
            @Param("hasEndDate") boolean hasEndDate,
            @Param("endDate") LocalDate endDate
    );

    boolean existsByInvoiceIdAndOrganizationOrganizationId(Long invoiceId, Long organizationId);

    @EntityGraph(attributePaths = {"invoiceStatus", "organization", "supplier", "assignedUser"})
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
