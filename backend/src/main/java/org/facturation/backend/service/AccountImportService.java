package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountImportMapping;
import org.facturation.backend.dto.response.AccountImportInspection;
import org.facturation.backend.dto.response.AccountImportPreview;
import org.facturation.backend.dto.response.AccountImportPreview.Row;
import org.facturation.backend.dto.response.AccountImportPreview.Status;
import org.facturation.backend.dto.response.AccountImportResult;
import org.facturation.backend.exception.AccountImportException;
import org.facturation.backend.model.AuditLog;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AuditLogRepository;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.OrganizationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

@Service
public class AccountImportService {
    private final AccountImportCsvReader reader;
    private final ChartOfAccountRepository accounts;
    private final OrganizationRepository organizations;
    private final CurrentUserService currentUser;
    private final AuditLogRepository auditLogs;

    public AccountImportService(AccountImportCsvReader reader, ChartOfAccountRepository accounts,
                                OrganizationRepository organizations, CurrentUserService currentUser,
                                AuditLogRepository auditLogs) {
        this.reader = reader;
        this.accounts = accounts;
        this.organizations = organizations;
        this.currentUser = currentUser;
        this.auditLogs = auditLogs;
    }

    public AccountImportInspection inspect(MultipartFile file, String delimiter) {
        var csv = reader.read(file, delimiter);
        return new AccountImportInspection(csv.fileName(), csv.fileSize(), delimiter, csv.columns(),
                csv.records().size(), csv.records().stream().limit(5).map(AccountImportCsvReader.Record::cells).toList());
    }

    @Transactional(readOnly = true)
    public AccountImportPreview preview(MultipartFile file, String delimiter, AccountImportMapping mapping) {
        return analyze(reader.read(file, delimiter), mapping, currentUser.getCurrentUser().getOrganization().getOrganizationId());
    }

    @Transactional
    public AccountImportResult confirm(MultipartFile file, String delimiter, AccountImportMapping mapping,
                                       String fingerprint, boolean excludeInvalidRows) {
        var csv = reader.read(file, delimiter);
        User user = currentUser.getCurrentUser();
        Long organizationId = user.getOrganization().getOrganizationId();
        // Serialize imports for the organization; the unique constraint also protects concurrent CRUD.
        var organization = organizations.findForAccountImport(organizationId).orElseThrow();
        var preview = analyze(csv, mapping, organizationId);
        if (!preview.fingerprint().equals(fingerprint)) {
            throw new AccountImportException(HttpStatus.CONFLICT, "The import preview has changed. Review the file again before confirming");
        }
        if (preview.invalidRows() > 0 && !excludeInvalidRows) {
            throw invalid("Fix invalid rows or explicitly choose to exclude them before importing");
        }
        LocalDateTime now = LocalDateTime.now();
        List<ChartOfAccount> created = new ArrayList<>();
        for (Row row : preview.rows()) {
            if (row.status() != Status.NEW) continue;
            ChartOfAccount account = new ChartOfAccount();
            account.setOrganization(organization);
            account.setAccountNumber(row.accountNumber());
            account.setAccountLabel(row.accountLabel());
            account.setAccountType(row.accountType());
            account.setActive(row.active());
            account.setCreatedAt(now);
            account.setUpdatedAt(now);
            created.add(account);
        }
        try {
            accounts.saveAllAndFlush(created);
        } catch (DataIntegrityViolationException exception) {
            throw new AccountImportException(HttpStatus.CONFLICT, "The chart of accounts changed during import. No accounts were imported; review again");
        }
        if (!created.isEmpty()) {
            AuditLog audit = new AuditLog();
            audit.setOrganization(organization);
            audit.setUser(user);
            audit.setEntityName("ChartOfAccount");
            audit.setEntityId(organizationId);
            audit.setAction("CSV_IMPORT");
            audit.setNewValue("fingerprint=" + fingerprint + "; imported=" + created.size()
                    + "; existing=" + preview.existingAccounts() + "; duplicates=" + preview.duplicateAccounts()
                    + "; invalid=" + preview.invalidRows());
            audit.setCreatedAt(now);
            auditLogs.save(audit);
        }
        List<Row> resultRows = preview.rows().stream().map(row -> row.status() == Status.NEW
                ? new Row(row.lineNumber(), row.accountNumber(), row.accountLabel(), row.accountType(), row.active(), Status.IMPORTED, row.errors())
                : row).toList();
        return new AccountImportResult(created.size(), preview.existingAccounts(), preview.duplicateAccounts(),
                preview.invalidRows(), user.getUserId(), now, resultRows);
    }

    private AccountImportPreview analyze(AccountImportCsvReader.Csv csv, AccountImportMapping mapping, Long organizationId) {
        validateMapping(mapping, csv.columns().size());
        Set<String> existing = new HashSet<>(accounts.findAccountNumbersByOrganizationId(organizationId));
        Set<String> seen = new HashSet<>();
        List<Row> rows = new ArrayList<>();
        for (var record : csv.records()) {
            List<String> errors = new ArrayList<>();
            if (record.cells().size() != csv.columns().size()) errors.add("Column count does not match the header");
            String number = value(record, mapping.accountNumber());
            String label = value(record, mapping.accountLabel());
            String type = value(record, mapping.accountType());
            String active = value(record, mapping.active());
            validateValue(number, "Account number", errors);
            validateValue(label, "Label", errors);
            validateValue(type, "Type", errors);
            if (!List.of("", "true", "false", "1", "0").contains(active.toLowerCase(java.util.Locale.ROOT))) {
                errors.add("Active must be true, false, 1 or 0 (empty means true)");
            }
            Status status = !errors.isEmpty() ? Status.INVALID : !seen.add(number) ? Status.DUPLICATE
                    : existing.contains(number) ? Status.EXISTING : Status.NEW;
            rows.add(new Row(record.lineNumber(), number, label, type,
                    !active.equalsIgnoreCase("false") && !active.equals("0"), status, List.copyOf(errors)));
        }
        return new AccountImportPreview(fingerprint(csv, mapping, organizationId, rows), rows.size(),
                count(rows, Status.NEW), count(rows, Status.EXISTING), count(rows, Status.DUPLICATE), count(rows, Status.INVALID), rows);
    }

    private void validateMapping(AccountImportMapping mapping, int columnCount) {
        if (mapping == null || mapping.accountNumber() == null || mapping.accountLabel() == null || mapping.accountType() == null) {
            throw invalid("Map account number, label and type before continuing");
        }
        List<Integer> indices = new ArrayList<>(List.of(mapping.accountNumber(), mapping.accountLabel(), mapping.accountType()));
        if (mapping.active() != null) indices.add(mapping.active());
        if (indices.stream().anyMatch(index -> index < 0 || index >= columnCount) || new HashSet<>(indices).size() != indices.size()) {
            throw invalid("Map each account field to a different existing CSV column");
        }
    }

    private String value(AccountImportCsvReader.Record record, Integer index) {
        return index == null || index >= record.cells().size() ? "" : record.cells().get(index).trim();
    }

    private void validateValue(String value, String name, List<String> errors) {
        if (value.isBlank()) errors.add(name + " is required");
        else if (value.length() > 255) errors.add(name + " must not exceed 255 characters");
    }

    private long count(List<Row> rows, Status status) { return rows.stream().filter(row -> row.status() == status).count(); }

    private String fingerprint(AccountImportCsvReader.Csv csv, AccountImportMapping mapping, Long organizationId, List<Row> rows) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            updateDigest(digest, organizationId.toString());
            updateDigest(digest, mapping.toString());
            updateDigest(digest, csv.fileName());
            updateDigest(digest, csv.contentHash());
            for (int i = 0; i < rows.size(); i++) {
                updateDigest(digest, Integer.toString(rows.get(i).lineNumber()));
                updateDigest(digest, rows.get(i).status().name());
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private void updateDigest(MessageDigest digest, String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        digest.update(ByteBuffer.allocate(4).putInt(bytes.length).array());
        digest.update(bytes);
    }

    private AccountImportException invalid(String message) { return new AccountImportException(HttpStatus.BAD_REQUEST, message); }
}
