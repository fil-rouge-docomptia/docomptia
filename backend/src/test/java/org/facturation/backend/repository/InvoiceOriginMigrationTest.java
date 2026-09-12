package org.facturation.backend.repository;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class InvoiceOriginMigrationTest {

    @Test
    void migrationBackfillsLegacyInvoicesAndRequiresAnOrigin() throws SQLException {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:invoice-origin-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE invoices (invoice_id BIGINT PRIMARY KEY)");
            statement.executeUpdate("INSERT INTO invoices VALUES (1)");
        }

        new ResourceDatabasePopulator(
                new ClassPathResource("db/migration/V364__add_invoice_origin.sql"))
                .execute(dataSource);

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try (var result = statement.executeQuery("SELECT origin FROM invoices WHERE invoice_id = 1")) {
                result.next();
                assertEquals("MANUAL_UPLOAD", result.getString(1));
            }
            statement.executeUpdate("INSERT INTO invoices (invoice_id) VALUES (2)");
            try (var result = statement.executeQuery("SELECT origin FROM invoices WHERE invoice_id = 2")) {
                result.next();
                assertEquals("MANUAL_UPLOAD", result.getString(1));
            }
            assertThrows(SQLException.class, () -> statement.executeUpdate(
                    "INSERT INTO invoices (invoice_id, origin) VALUES (3, NULL)"));
        }
    }
}
