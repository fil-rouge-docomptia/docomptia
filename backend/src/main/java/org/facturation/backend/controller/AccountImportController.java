package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.AccountImportMapping;
import org.facturation.backend.dto.response.AccountImportInspection;
import org.facturation.backend.dto.response.AccountImportPreview;
import org.facturation.backend.dto.response.AccountImportResult;
import org.facturation.backend.service.AccountImportService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/chart-of-accounts/import")
@Tag(name = "Import du plan comptable", description = "CSV UTF-8, 20 MiB maximum, 10000 lignes, 100 colonnes ; ADMIN uniquement")
public class AccountImportController {
    private final AccountImportService service;

    public AccountImportController(AccountImportService service) { this.service = service; }

    @PostMapping(value = "/inspect", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Inspecter les colonnes et cinq exemples sans creer de compte")
    public AccountImportInspection inspect(@RequestPart @Schema(type = "string", format = "binary") MultipartFile file,
                                           @RequestParam(defaultValue = ",") String delimiter) {
        return service.inspect(file, delimiter);
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Verifier le mapping et chaque ligne sans ecriture", description = "La part mapping est un objet application/json")
    public AccountImportPreview preview(@RequestPart @Schema(type = "string", format = "binary") MultipartFile file,
                                        @RequestParam(defaultValue = ",") String delimiter,
                                        @RequestPart AccountImportMapping mapping) {
        return service.preview(file, delimiter, mapping);
    }

    @PostMapping(value = "/confirm", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Confirmer la creation des nouveaux comptes ; conserver les comptes existants")
    @ApiResponse(responseCode = "409", description = "Previsualisation perimee ou conflit concurrent ; aucune ecriture partielle")
    public AccountImportResult confirm(@RequestPart @Schema(type = "string", format = "binary") MultipartFile file,
                                       @RequestParam(defaultValue = ",") String delimiter,
                                       @RequestPart AccountImportMapping mapping,
                                       @RequestParam String fingerprint,
                                       @RequestParam(defaultValue = "false") boolean excludeInvalidRows) {
        return service.confirm(file, delimiter, mapping, fingerprint, excludeInvalidRows);
    }
}
