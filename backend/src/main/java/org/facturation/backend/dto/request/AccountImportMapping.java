package org.facturation.backend.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Zero-based CSV column indices; number, label and type are required and distinct")
public record AccountImportMapping(Integer accountNumber, Integer accountLabel, Integer accountType,
                                   @Schema(description = "Optional; unmapped or empty values mean true") Integer active) {}
