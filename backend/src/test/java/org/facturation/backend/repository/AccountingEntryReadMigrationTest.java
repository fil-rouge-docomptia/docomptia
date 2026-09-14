package org.facturation.backend.repository;

import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AccountingEntryReadMigrationTest {
    @Test
    void backfillsOnlyProvenOriginalExportsAndNeverInventsJournals() {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:kan386-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE organizations (organization_id BIGINT PRIMARY KEY)");
        jdbc.execute("CREATE TABLE export_batches (export_batch_id BIGINT PRIMARY KEY, organization_id BIGINT, status VARCHAR(30))");
        jdbc.execute("CREATE TABLE invoices (invoice_id BIGINT PRIMARY KEY, organization_id BIGINT, export_batch_id BIGINT)");
        jdbc.execute("CREATE TABLE accounting_entries (accounting_entry_id BIGINT PRIMARY KEY, invoice_id BIGINT, "
                + "status VARCHAR(30), reversed_accounting_entry_id BIGINT, entry_date DATE)");
        jdbc.update("INSERT INTO organizations VALUES (1), (2)");
        jdbc.update("INSERT INTO export_batches VALUES (1,1,'GENERE'), (2,1,'ARCHIVE'), (3,1,'PREPARATION'), (4,2,'GENERE')");
        jdbc.update("INSERT INTO invoices VALUES (1,1,1), (2,1,2), (3,1,3), (4,1,4), (5,1,NULL), (6,1,1)");
        jdbc.update("INSERT INTO accounting_entries VALUES "
                + "(1,1,'GENERATED',NULL,NULL), (2,1,'REVERSAL',1,NULL), (3,1,'CORRECTIVE',2,NULL), "
                + "(4,2,'GENERATED',NULL,NULL), (5,3,'GENERATED',NULL,NULL), (6,4,'GENERATED',NULL,NULL), "
                + "(7,5,'GENERATED',NULL,NULL), (8,6,'GENERATED',NULL,NULL), (9,6,'GENERATED',NULL,NULL)");
        ResourceDatabasePopulator migration = new ResourceDatabasePopulator(new ClassPathResource(
                "db/migration/V386__add_accounting_journals_and_entry_exports.sql"));
        migration.execute(dataSource);
        migration.execute(dataSource);

        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM accounting_journals", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT COUNT(*) FROM accounting_entries WHERE export_batch_id IS NOT NULL", Integer.class));
        assertEquals(1L, jdbc.queryForObject("SELECT export_batch_id FROM accounting_entries WHERE accounting_entry_id=1", Long.class));
        assertEquals(2L, jdbc.queryForObject("SELECT export_batch_id FROM accounting_entries WHERE accounting_entry_id=4", Long.class));
        assertNull(jdbc.queryForObject("SELECT export_batch_id FROM accounting_entries WHERE accounting_entry_id=3", Long.class));
        jdbc.update("INSERT INTO accounting_journals VALUES (1,1,'ACH','Purchases',true), (2,2,'ACH','Other purchases',true)");
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("INSERT INTO accounting_journals VALUES (3,1,'ACH','Duplicate',true)"));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE accounting_entries SET accounting_journal_id=999 WHERE accounting_entry_id=1"));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> jdbc.update("UPDATE accounting_entries SET export_batch_id=999 WHERE accounting_entry_id=1"));
        jdbc.update("UPDATE accounting_entries SET accounting_journal_id=1 WHERE accounting_entry_id=1");
        migration.execute(dataSource);
        assertEquals(1L, jdbc.queryForObject("SELECT accounting_journal_id FROM accounting_entries WHERE accounting_entry_id=1", Long.class));
    }
}
