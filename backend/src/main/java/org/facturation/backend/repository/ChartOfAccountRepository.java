package org.facturation.backend.repository;

import org.facturation.backend.model.ChartOfAccount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChartOfAccountRepository extends JpaRepository<ChartOfAccount, Long> {
}
