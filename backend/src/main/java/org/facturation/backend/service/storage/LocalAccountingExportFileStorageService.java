package org.facturation.backend.service.storage;

import org.facturation.backend.exception.AccountingExportFileNotFoundException;
import org.facturation.backend.model.ExportBatch;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalAccountingExportFileStorageService implements AccountingExportFileStorageService {

    private final String localDirectory;

    public LocalAccountingExportFileStorageService(@Value("${app.storage.local-dir:}") String localDirectory) {
        this.localDirectory = localDirectory;
    }

    @Override
    public StoredAccountingExportFile store(byte[] content, String fileName, Long exportBatchId) {
        String safeFileName = sanitize(fileName);
        String storedFileName = UUID.randomUUID() + "-" + safeFileName;
        Path directory = resolveDirectory().resolve("accounting-exports").resolve(exportBatchId.toString());
        Path target = directory.resolve(storedFileName);
        try {
            Files.createDirectories(directory);
            Files.write(target, content);
            return new StoredAccountingExportFile(
                    safeFileName,
                    storedFileName,
                    target.toString(),
                    (long) content.length
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to store accounting export file", exception);
        }
    }

    @Override
    public byte[] load(ExportBatch exportBatch) {
        try {
            return Files.readAllBytes(Path.of(exportBatch.getFilePath()));
        } catch (NoSuchFileException | NullPointerException exception) {
            throw new AccountingExportFileNotFoundException(exportBatch.getExportBatchId());
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read stored accounting export file", exception);
        }
    }

    @Override
    public void delete(StoredAccountingExportFile file) {
        try {
            Files.deleteIfExists(Path.of(file.filePath()));
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to remove rolled-back accounting export file", exception);
        }
    }

    private Path resolveDirectory() {
        if (localDirectory == null || localDirectory.isBlank()) {
            return Path.of(System.getProperty("java.io.tmpdir"), "facturation-files");
        }
        return Path.of(localDirectory);
    }

    private String sanitize(String fileName) {
        return fileName.replace("\\", "_").replace("/", "_");
    }
}
