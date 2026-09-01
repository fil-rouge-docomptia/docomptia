package org.facturation.backend.repository;

import org.facturation.backend.model.Supplier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    Page<Supplier> findByOrganizationOrganizationId(Long organizationId, Pageable pageable);

    @Query(
            value = """
            select s from Supplier s
            left join SupplierLegalIdentifier i on i.supplier = s
            where s.organization.organizationId = :organizationId
              and (s.searchName like concat('%', :query, '%')
                   or i.normalizedValue like concat('%', :normalizedQuery, '%'))
            group by s
            order by min(case when i.normalizedValue = :normalizedQuery then 0 else 1 end),
                     s.legalName asc,
                     s.supplierId asc
            """,
            countQuery = """
            select count(distinct s.supplierId) from Supplier s
            left join SupplierLegalIdentifier i on i.supplier = s
            where s.organization.organizationId = :organizationId
              and (s.searchName like concat('%', :query, '%')
                   or i.normalizedValue like concat('%', :normalizedQuery, '%'))
            """
    )
    Page<Supplier> search(@Param("organizationId") Long organizationId,
                          @Param("query") String query,
                          @Param("normalizedQuery") String normalizedQuery,
                          Pageable pageable);

    Optional<Supplier> findBySupplierIdAndOrganizationOrganizationId(Long supplierId, Long organizationId);

    Optional<Supplier> findByOrganizationOrganizationIdAndNameIgnoreCase(Long organizationId, String name);

    Optional<Supplier> findByOrganizationOrganizationIdAndLegalNameIgnoreCase(Long organizationId, String legalName);

    Optional<Supplier> findByOrganizationOrganizationIdAndSiret(Long organizationId, String siret);

    Optional<Supplier> findByOrganizationOrganizationIdAndVatNumberIgnoreCase(Long organizationId, String vatNumber);

    boolean existsByOrganizationOrganizationIdAndSiretAndSupplierIdNot(
            Long organizationId,
            String siret,
            Long supplierId
    );

    boolean existsByOrganizationOrganizationIdAndVatNumberIgnoreCaseAndSupplierIdNot(
            Long organizationId,
            String vatNumber,
            Long supplierId
    );
}
