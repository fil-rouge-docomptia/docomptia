package org.facturation.backend.service;

import org.facturation.backend.exception.AccountImportException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class AccountImportCsvReader {
    public static final int MAX_BYTES = 20 * 1024 * 1024;
    private static final int MAX_ROWS = 10_000;
    private static final int MAX_COLUMNS = 100;
    private static final Set<String> MIME_TYPES = Set.of("text/csv", "application/csv", "text/plain",
            "application/vnd.ms-excel", "application/octet-stream");

    public record Record(int lineNumber, List<String> cells) {}
    public record Csv(String fileName, long fileSize, String contentHash, List<String> columns, List<Record> records) {}

    public Csv read(MultipartFile file, String delimiter) {
        if (!List.of(",", ";").contains(delimiter)) throw invalid("Choose a comma or semicolon delimiter");
        String name = file.getOriginalFilename();
        if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw invalid("Choose a .csv file");
        }
        String mime = file.getContentType();
        if (mime != null && !mime.isBlank() && !MIME_TYPES.contains(mime.split(";", 2)[0].toLowerCase(Locale.ROOT))) {
            throw invalid("Unsupported CSV file type");
        }
        if (file.isEmpty()) throw invalid("The CSV file is empty");
        if (file.getSize() > MAX_BYTES) throw new AccountImportException(HttpStatus.PAYLOAD_TOO_LARGE, "CSV files must not exceed 20 MiB");
        try (var stream = file.getInputStream()) {
            byte[] bytes = stream.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw new AccountImportException(HttpStatus.PAYLOAD_TOO_LARGE, "CSV files must not exceed 20 MiB");
            String text = decode(bytes);
            if (text.startsWith("\uFEFF")) text = text.substring(1);
            List<Record> records = parse(text, delimiter.charAt(0));
            if (records.size() < 2) throw invalid("The CSV needs a header and at least one data row");
            List<String> columns = records.removeFirst().cells().stream().map(String::trim).toList();
            if (columns.size() < 3 || columns.stream().anyMatch(String::isBlank)
                    || new HashSet<>(columns).size() != columns.size()) {
                throw invalid("Use at least three non-empty, distinct column headers; check the delimiter");
            }
            name = name.replace('\\', '/');
            name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
            return new Csv(name, bytes.length, contentHash(bytes), columns, records);
        } catch (IOException exception) {
            throw invalid("The CSV file could not be read");
        }
    }

    private String contentHash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private String decode(byte[] bytes) {
        try {
            return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException exception) {
            throw invalid("Save the CSV using UTF-8 encoding");
        }
    }

    private List<Record> parse(String text, char delimiter) {
        List<Record> records = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        boolean closed = false;
        int line = 1;
        int recordLine = 1;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if ((c < 32 && c != '\r' && c != '\n' && c != '\t') || c == 127) throw invalid("The file contains binary or unsupported control characters");
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { cell.append('"'); i++; }
                    else { quoted = false; closed = true; }
                } else {
                    cell.append(c);
                    if (c == '\n' || (c == '\r' && (i + 1 == text.length() || text.charAt(i + 1) != '\n'))) line++;
                }
            } else if (c == delimiter || c == '\r' || c == '\n') {
                addCell(cells, cell);
                closed = false;
                if (c != delimiter) {
                    addRecord(records, cells, recordLine);
                    cells = new ArrayList<>();
                    if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                    recordLine = ++line;
                }
            } else if (closed) {
                throw invalid("Unexpected character after a quoted field at line " + line);
            } else if (c == '"') {
                if (!cell.isEmpty()) throw invalid("Unexpected quote at line " + line);
                quoted = true;
            } else cell.append(c);
            if (cell.length() > 8192) throw invalid("CSV fields must not exceed 8192 characters");
        }
        if (quoted) throw invalid("Unclosed quoted field at line " + recordLine);
        if (!cell.isEmpty() || !cells.isEmpty() || closed) {
            addCell(cells, cell);
            addRecord(records, cells, recordLine);
        }
        return records;
    }

    private void addCell(List<String> cells, StringBuilder cell) {
        cells.add(cell.toString());
        cell.setLength(0);
        if (cells.size() > MAX_COLUMNS) throw invalid("CSV files must not exceed 100 columns");
    }

    private void addRecord(List<Record> records, List<String> cells, int line) {
        if (cells.size() == 1 && cells.getFirst().isBlank()) return;
        records.add(new Record(line, List.copyOf(cells)));
        if (records.size() > MAX_ROWS + 1) throw invalid("CSV files must not exceed 10000 data rows");
    }

    private AccountImportException invalid(String message) {
        return new AccountImportException(HttpStatus.BAD_REQUEST, message);
    }
}
