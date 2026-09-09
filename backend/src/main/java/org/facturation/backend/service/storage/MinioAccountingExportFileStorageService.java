package org.facturation.backend.service.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.errors.ErrorResponseException;
import org.facturation.backend.exception.AccountingExportFileNotFoundException;
import org.facturation.backend.model.ExportBatch;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class MinioAccountingExportFileStorageService implements AccountingExportFileStorageService {

    private static final String CSV_MIME_TYPE = "text/csv";

    private final MinioClient minioClient;
    private final String bucketName;

    public MinioAccountingExportFileStorageService(
            @Value("${app.storage.s3.endpoint}") String endpoint,
            @Value("${app.storage.s3.access-key}") String accessKey,
            @Value("${app.storage.s3.secret-key}") String secretKey,
            @Value("${app.storage.s3.bucket}") String bucketName
    ) {
        this.minioClient = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        this.bucketName = bucketName;
    }

    @Override
    public StoredAccountingExportFile store(byte[] content, String fileName, Long exportBatchId) {
        String safeFileName = sanitize(fileName);
        String objectName = "accounting-exports/" + exportBatchId + "/" + UUID.randomUUID() + "-" + safeFileName;
        try {
            ensureBucketExists();
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(objectName)
                    .stream(new ByteArrayInputStream(content), content.length, -1)
                    .contentType(CSV_MIME_TYPE)
                    .build());
            return new StoredAccountingExportFile(
                    safeFileName,
                    objectName,
                    "s3://" + bucketName + "/" + objectName,
                    (long) content.length
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to store accounting export file in MinIO", exception);
        }
    }

    @Override
    public byte[] load(ExportBatch exportBatch) {
        if (exportBatch.getStoredFileName() == null) {
            throw new AccountingExportFileNotFoundException(exportBatch.getExportBatchId());
        }
        try (var inputStream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucketName)
                .object(exportBatch.getStoredFileName())
                .build())) {
            return inputStream.readAllBytes();
        } catch (ErrorResponseException exception) {
            if (isMissingObject(exception)) {
                throw new AccountingExportFileNotFoundException(exportBatch.getExportBatchId());
            }
            throw new IllegalStateException("Unable to read stored accounting export file from MinIO", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read stored accounting export file from MinIO", exception);
        }
    }

    @Override
    public void delete(StoredAccountingExportFile file) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucketName).object(file.storedFileName()).build());
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to remove rolled-back accounting export from MinIO", exception);
        }
    }

    private boolean isMissingObject(ErrorResponseException exception) {
        String errorCode = exception.errorResponse().code();
        return "NoSuchKey".equals(errorCode)
                || "NoSuchObject".equals(errorCode)
                || "NoSuchBucket".equals(errorCode);
    }

    private void ensureBucketExists() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder()
                .bucket(bucketName)
                .build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder()
                    .bucket(bucketName)
                    .build());
        }
    }

    private String sanitize(String fileName) {
        return fileName.replace("\\", "_").replace("/", "_");
    }
}
