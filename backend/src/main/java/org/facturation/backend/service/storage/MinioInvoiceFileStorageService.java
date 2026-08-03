package org.facturation.backend.service.storage;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import org.facturation.backend.model.InvoiceFile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class MinioInvoiceFileStorageService implements InvoiceFileStorageService {

    private final MinioClient minioClient;
    private final String bucketName;

    public MinioInvoiceFileStorageService(
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
    public StoredInvoiceFile store(MultipartFile file, Long invoiceId) {
        String originalFileName = resolveOriginalFileName(file);
        String objectName = "invoices/" + invoiceId + "/" + UUID.randomUUID() + "-" + originalFileName;
        String mimeType = resolveMimeType(file);

        try {
            ensureBucketExists();
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucketName)
                    .object(objectName)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(mimeType)
                    .build());

            return new StoredInvoiceFile(
                    originalFileName,
                    objectName,
                    "s3://" + bucketName + "/" + objectName,
                    mimeType,
                    file.getSize()
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to store uploaded file in MinIO", exception);
        }
    }

    @Override
    public MultipartFile load(InvoiceFile invoiceFile) {
        try (var inputStream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(bucketName)
                .object(invoiceFile.getStoredFileName())
                .build())) {
            return new StoredMultipartFile(
                    invoiceFile.getOriginalFileName(),
                    invoiceFile.getMimeType(),
                    inputStream.readAllBytes()
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read stored invoice file from MinIO", exception);
        }
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

    private String resolveOriginalFileName(MultipartFile file) {
        return sanitize(file.getOriginalFilename() == null ? "invoice-file" : file.getOriginalFilename());
    }

    private String resolveMimeType(MultipartFile file) {
        return file.getContentType() == null ? "application/octet-stream" : file.getContentType();
    }

    private String sanitize(String fileName) {
        return fileName.replace("\\", "_").replace("/", "_");
    }
}
