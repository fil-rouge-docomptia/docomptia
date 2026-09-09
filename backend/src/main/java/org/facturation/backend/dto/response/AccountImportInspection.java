package org.facturation.backend.dto.response;

import java.util.List;

public record AccountImportInspection(String fileName, long fileSize, String delimiter, List<String> columns,
                                      int totalRows, List<List<String>> sampleRows) {}
