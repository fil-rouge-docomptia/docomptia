package org.facturation.backend.repository;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AccountingEntrySupplierAccountMigrationTest {

    @Test
    void migrationLinksAccountingLinesToOptionalSupplierAccounts() throws SQLException {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:accounting-entry-supplier-account-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE supplier_accounts (supplier_account_id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE accounting_entry_lines (accounting_entry_line_id BIGINT PRIMARY KEY)");
        }

        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V347__link_supplier_accounts_to_accounting_entry_lines.sql"))
                .execute(dataSource);

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO supplier_accounts VALUES (10)");
            statement.executeUpdate("INSERT INTO accounting_entry_lines VALUES (1, NULL), (2, 10)");

            assertThrows(SQLException.class, () -> statement.executeUpdate(
                    "INSERT INTO accounting_entry_lines VALUES (3, 999)"));
            try (var result = statement.executeQuery(
                    "SELECT COUNT(*) FROM accounting_entry_lines WHERE supplier_account_id = 10")) {
                result.next();
                assertEquals(1, result.getInt(1));
            }
        }
    }
}
