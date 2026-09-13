package org.facturation.backend.repository;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccountingEntryLineMutationMigrationTest {
    @Test
    void preservesHistoricalLinesWithoutInferringVatAndEnforcesReceiptUniqueness() {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:kan387-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE accounting_entries (accounting_entry_id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE classifications (classification_id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE accounting_entry_lines (accounting_entry_line_id BIGINT PRIMARY KEY, debit_amount NUMERIC(12,2), credit_amount NUMERIC(12,2))");
        jdbc.update("INSERT INTO accounting_entries VALUES (1),(2)");
        jdbc.update("INSERT INTO classifications VALUES (1)");
        jdbc.update("INSERT INTO accounting_entry_lines VALUES (1,120,0),(2,0,120)");
        ResourceDatabasePopulator migration = new ResourceDatabasePopulator(new ClassPathResource(
                "db/migration/V387__add_accounting_line_metadata_and_mutations.sql"));
        migration.execute(dataSource);
        migration.execute(dataSource);
        assertThat(jdbc.queryForObject("SELECT SUM(version) FROM accounting_entries", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entry_lines WHERE vat_rate IS NULL AND classification_id IS NULL", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT SUM(debit_amount-credit_amount) FROM accounting_entry_lines", java.math.BigDecimal.class)).isEqualByComparingTo("0");
        jdbc.update("UPDATE accounting_entry_lines SET vat_rate=5.50, classification_id=1 WHERE accounting_entry_line_id=1");
        jdbc.update("INSERT INTO accounting_entry_mutations VALUES (1,1,'request','fingerprint'),(2,2,'request','fingerprint')");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO accounting_entry_mutations VALUES (3,1,'request','other')"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE accounting_entry_lines SET classification_id=999 WHERE accounting_entry_line_id=1"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        migration.execute(dataSource);
        assertThat(jdbc.queryForObject("SELECT vat_rate FROM accounting_entry_lines WHERE accounting_entry_line_id=1", java.math.BigDecimal.class)).isEqualByComparingTo("5.50");
    }
}
