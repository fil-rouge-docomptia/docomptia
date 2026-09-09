package org.facturation.backend.repository;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SupplierAccountMigrationTest {

    @Test
    void migrationCreatesSupplierAccountsWithRequiredConstraints() throws SQLException {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:supplier-account-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE organizations (organization_id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE chart_of_accounts (account_id BIGINT PRIMARY KEY)");
            statement.execute("CREATE TABLE suppliers (supplier_id BIGINT PRIMARY KEY)");
        }

        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V344__create_supplier_accounts.sql"))
                .execute(dataSource);

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO organizations VALUES (1), (2)");
            statement.executeUpdate("INSERT INTO chart_of_accounts VALUES (10)");
            statement.executeUpdate("INSERT INTO supplier_accounts "
                    + "(organization_id, collective_account_id, code, label, is_active) "
                    + "VALUES (1, 10, 'ORANGE', 'Orange SA', TRUE)");
            statement.executeUpdate("INSERT INTO supplier_accounts "
                    + "(organization_id, collective_account_id, code, label, is_active) "
                    + "VALUES (2, 10, 'ORANGE', 'Orange autre organisation', TRUE)");

            assertThrows(SQLException.class, () -> statement.executeUpdate("INSERT INTO supplier_accounts "
                    + "(organization_id, collective_account_id, code, label, is_active) "
                    + "VALUES (1, 10, 'ORANGE', 'Doublon', TRUE)"));

            try (var result = statement.executeQuery("SELECT COUNT(*) FROM supplier_accounts")) {
                result.next();
                assertEquals(2, result.getInt(1));
            }
        }
    }
}
