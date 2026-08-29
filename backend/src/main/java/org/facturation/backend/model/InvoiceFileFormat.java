package org.facturation.backend.model;

import java.util.Set;

public enum InvoiceFileFormat {
    PDF("PDF", "PDF", Set.of("pdf"), Set.of("application/pdf"),
            new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D}),
    PNG("PNG", "Image PNG", Set.of("png"), Set.of("image/png"),
            new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}),
    JPEG("JPEG", "Image JPEG", Set.of("jpg", "jpeg"), Set.of("image/jpeg"),
            new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF});

    private final String code;
    private final String label;
    private final Set<String> extensions;
    private final Set<String> mimeTypes;
    private final byte[] signature;

    InvoiceFileFormat(
            String code,
            String label,
            Set<String> extensions,
            Set<String> mimeTypes,
            byte[] signature
    ) {
        this.code = code;
        this.label = label;
        this.extensions = extensions;
        this.mimeTypes = mimeTypes;
        this.signature = signature;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    public boolean supportsExtension(String extension) {
        return extensions.contains(extension);
    }

    public boolean supportsMimeType(String mimeType) {
        return mimeTypes.contains(mimeType);
    }

    public byte[] getSignature() {
        return signature.clone();
    }
}
