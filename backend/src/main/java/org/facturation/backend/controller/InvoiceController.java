package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.facturation.backend.dto.request.DuplicateAlertDecisionRequest;
import org.facturation.backend.dto.request.InvoiceAssigneeRequest;
import org.facturation.backend.dto.request.InvoiceClassificationRequest;
import org.facturation.backend.dto.request.InvoiceCorrectionDemandRequest;
import org.facturation.backend.dto.request.InvoiceCorrectionRequest;
import org.facturation.backend.dto.request.InvoiceRejectionRequest;
import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceHistoryItemResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.exception.InvoiceFileNotFoundException;
import org.facturation.backend.exception.InvoiceNotFoundException;
import org.facturation.backend.service.InvoiceHistoryService;
import org.facturation.backend.service.InvoiceService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/invoices")
@Tag(name = "Factures", description = "Depot, consultation et traitement des factures")
public class InvoiceController {

    private static final Set<String> ALLOWED_SEARCH_PARAMS = Set.of(
            "status", "supplier", "client", "invoiceNumber", "invoiceDate", "dueDate", "startDate", "endDate",
            "minAmount", "maxAmount", "page", "size", "sortBy", "direction"
    );
    private static final Set<String> ALLOWED_PAGINATION_PARAMS = Set.of("page", "size", "sortBy", "direction");
    private static final Map<String, String> SORT_PROPERTIES = Map.of(
            "createdAt", "createdAt",
            "invoiceDate", "invoiceDate",
            "date", "invoiceDate",
            "totalTtc", "totalTtc",
            "amount", "totalTtc",
            "status", "invoiceStatus.code"
    );

    private final InvoiceService invoiceService;
    private final InvoiceHistoryService invoiceHistoryService;

    public InvoiceController(InvoiceService invoiceService, InvoiceHistoryService invoiceHistoryService) {
        this.invoiceService = invoiceService;
        this.invoiceHistoryService = invoiceHistoryService;
    }

    @GetMapping
    @Operation(summary = "Rechercher les factures")
    @Parameters({
            @Parameter(
                    name = "status",
                    description = "Codes des statuts, repetables ou separes par des virgules",
                    example = "EXTRAITE,VALIDEE"
            ),
            @Parameter(name = "supplier", description = "Nom ou identifiant du fournisseur", example = "Orange"),
            @Parameter(name = "client", description = "Nom ou identifiant du client", example = "Docomptia"),
            @Parameter(name = "invoiceNumber", description = "Numero de facture exact ou partiel", example = "FAC-2026"),
            @Parameter(name = "invoiceDate", description = "Date de facture au format ISO", example = "2026-07-21"),
            @Parameter(name = "dueDate", description = "Date d'echeance au format ISO", example = "2026-08-21"),
            @Parameter(name = "startDate", description = "Debut inclusif de la periode de facturation", example = "2026-07-01"),
            @Parameter(name = "endDate", description = "Fin inclusive de la periode de facturation", example = "2026-07-31"),
            @Parameter(name = "minAmount", description = "Montant TTC minimum inclusif", example = "100.00"),
            @Parameter(name = "maxAmount", description = "Montant TTC maximum inclusif", example = "500.00"),
            @Parameter(name = "page", description = "Numero de page, commence a zero", example = "0"),
            @Parameter(name = "size", description = "Nombre de factures par page", example = "20"),
            @Parameter(name = "sortBy", description = "Champ de tri: invoiceDate, totalTtc ou status"),
            @Parameter(name = "direction", description = "Sens du tri: ASC ou DESC")
    })
    public ResponseEntity<Page<InvoiceListItemResponse>> searchInvoices(
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params
    ) {
        if (!ALLOWED_SEARCH_PARAMS.containsAll(params.keySet())) {
            throw new IllegalArgumentException(
                    "Unsupported invoice search parameters: "
                            + String.join(", ", params.keySet().stream()
                            .filter(param -> !ALLOWED_SEARCH_PARAMS.contains(param))
                            .sorted()
                            .toList())
            );
        }

        PageRequest pageRequest = createPageRequest(params);

        return ResponseEntity.ok(invoiceService.searchInvoices(
                params.get("status"),
                params.getFirst("supplier"),
                params.getFirst("client"),
                params.getFirst("invoiceNumber"),
                params.getFirst("invoiceDate"),
                params.getFirst("dueDate"),
                params.getFirst("startDate"),
                params.getFirst("endDate"),
                params.getFirst("minAmount"),
                params.getFirst("maxAmount"),
                pageRequest
        ));
    }

    @GetMapping("/pending-validation")
    @Operation(
            summary = "Lister les factures en attente de validation",
            description = "Retourne une page de factures A_VERIFIER de l'organisation du validateur connecte"
    )
    @Parameters({
            @Parameter(name = "page", description = "Numero de page, commence a zero", example = "0"),
            @Parameter(name = "size", description = "Nombre de factures par page", example = "20"),
            @Parameter(name = "sortBy", description = "Champ de tri: invoiceDate, totalTtc ou status"),
            @Parameter(name = "direction", description = "Sens du tri: ASC ou DESC")
    })
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Page de factures en attente retournee"),
            @ApiResponse(responseCode = "401", description = "Authentification requise"),
            @ApiResponse(responseCode = "403", description = "Role validateur requis")
    })
    public ResponseEntity<Page<InvoiceListItemResponse>> findPendingValidationInvoices(
            @Parameter(hidden = true) @RequestParam MultiValueMap<String, String> params
    ) {
        if (!ALLOWED_PAGINATION_PARAMS.containsAll(params.keySet())) {
            throw new IllegalArgumentException(
                    "Unsupported pending validation parameters: "
                            + String.join(", ", params.keySet().stream()
                            .filter(param -> !ALLOWED_PAGINATION_PARAMS.contains(param))
                            .sorted()
                            .toList())
            );
        }

        return ResponseEntity.ok(invoiceService.findPendingValidationInvoices(createPageRequest(params)));
    }

    private PageRequest createPageRequest(MultiValueMap<String, String> params) {
        int page = parseNonNegativeInteger(Optional.ofNullable(params.getFirst("page")).orElse("0"), "page");
        int size = parsePositiveInteger(Optional.ofNullable(params.getFirst("size")).orElse("20"), "size");
        String sortBy = Optional.ofNullable(params.getFirst("sortBy")).orElse("createdAt");
        String sortProperty = SORT_PROPERTIES.get(sortBy);
        if (sortProperty == null) {
            throw new IllegalArgumentException("Invalid invoice sort field: " + sortBy);
        }
        Sort.Direction direction;
        try {
            direction = Sort.Direction.fromString(Optional.ofNullable(params.getFirst("direction")).orElse("DESC"));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid invoice sort direction", exception);
        }
        return PageRequest.of(
                page,
                size,
                Sort.by(direction, sortProperty).and(Sort.by("invoiceId").ascending())
        );
    }

    private int parseNonNegativeInteger(String value, String fieldName) {
        int parsedValue = parseInteger(value, fieldName);
        if (parsedValue < 0) {
            throw new IllegalArgumentException(fieldName + " must be greater than or equal to zero");
        }
        return parsedValue;
    }

    private int parsePositiveInteger(String value, String fieldName) {
        int parsedValue = parseInteger(value, fieldName);
        if (parsedValue < 1) {
            throw new IllegalArgumentException(fieldName + " must be greater than zero");
        }
        return parsedValue;
    }

    private int parseInteger(String value, String fieldName) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(fieldName + " must be an integer", exception);
        }
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Deposer et analyser une facture")
    public ResponseEntity<InvoiceUploadResponse> uploadInvoice(
            @Parameter(
                    description = "Facture PDF, PNG ou JPEG a analyser (10 Mo maximum)",
                    required = true,
                    schema = @Schema(type = "string", format = "binary")
            )
            @RequestParam("file") MultipartFile file,
            @Parameter(description = "Identifiant fournisseur optionnel", example = "1")
            @RequestParam(value = "supplierId", required = false) Long supplierId
    ) {
        return ResponseEntity.ok(invoiceService.uploadAndAnalyze(file, supplierId));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter le detail d'une facture")
    public ResponseEntity<InvoiceDetailsResponse> getInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.findDetailsById(id), id));
    }

    @GetMapping("/{id}/file")
    @Operation(summary = "Telecharger le fichier original d'une facture")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fichier original retourne"),
            @ApiResponse(responseCode = "404", description = "Fichier original absent ou inaccessible")
    })
    public ResponseEntity<byte[]> downloadInvoiceFile(@PathVariable Long id) throws IOException {
        MultipartFile file = invoiceService.downloadFile(id)
                .orElseThrow(() -> new InvoiceFileNotFoundException(id));
        return invoiceFileResponse(file, ContentDisposition.attachment());
    }

    @GetMapping("/{id}/preview")
    @Operation(summary = "Previsualiser le fichier original d'une facture")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Fichier original retourne pour affichage dans le navigateur"),
            @ApiResponse(responseCode = "404", description = "Facture introuvable dans l'organisation de l'utilisateur"),
            @ApiResponse(responseCode = "415", description = "Format du fichier non previsualisable")
    })
    public ResponseEntity<byte[]> previewInvoiceFile(@PathVariable Long id) throws IOException {
        MultipartFile file = requireInvoiceResponse(invoiceService.previewFile(id), id);
        return invoiceFileResponse(file, ContentDisposition.inline());
    }

    private ResponseEntity<byte[]> invoiceFileResponse(
            MultipartFile file,
            ContentDisposition.Builder contentDisposition
    ) throws IOException {
        String fileName = file.getOriginalFilename() == null ? "invoice-file" : file.getOriginalFilename();
        MediaType mediaType = file.getContentType() == null
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(file.getContentType());

        return ResponseEntity.ok()
                .contentType(mediaType)
                .contentLength(file.getSize())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        contentDisposition
                                .filename(fileName, StandardCharsets.UTF_8)
                                .build()
                                .toString()
                )
                .body(file.getBytes());
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Consulter l'historique des statuts et corrections d'une facture")
    @ApiResponse(responseCode = "404", description = "Facture introuvable dans l'organisation de l'utilisateur")
    public ResponseEntity<List<InvoiceHistoryItemResponse>> getInvoiceHistory(@PathVariable Long id) {
        return ResponseEntity.ok(invoiceHistoryService.findByInvoiceId(id));
    }

    @PostMapping("/{id}/ocr/retry")
    @Operation(summary = "Relancer l'analyse OCR d'une facture en erreur")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Analyse OCR relancee"),
            @ApiResponse(responseCode = "409", description = "Relance OCR interdite pour le statut courant")
    })
    public ResponseEntity<InvoiceDetailsResponse> retryOcr(@PathVariable Long id) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.retryOcr(id), id));
    }

    @PostMapping("/{id}/accounting-entry")
    @Operation(summary = "Generer l'ecriture comptable d'une facture")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ecriture comptable generee"),
            @ApiResponse(
                    responseCode = "409",
                    description = "Facture non validee, prerequis comptables invalides ou ecriture desequilibree"
            )
    })
    public ResponseEntity<InvoiceAccountingEntryResponse> generateAccountingEntry(@PathVariable Long id) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.generateAccountingEntry(id), id));
    }

    @PatchMapping("/{id}")
    @Operation(
            summary = "Corriger manuellement une facture",
            description = "Met a jour les donnees extraites corrigees sans ecraser les valeurs OCR brutes et enregistre la valeur avant et apres chaque champ modifie"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Facture corrigee"),
            @ApiResponse(responseCode = "400", description = "Donnees de correction invalides ou aucune modification effective"),
            @ApiResponse(responseCode = "409", description = "Correction interdite pour le statut courant")
    })
    public ResponseEntity<InvoiceDetailsResponse> correctInvoice(
            @PathVariable Long id,
            @RequestBody InvoiceCorrectionRequest request
    ) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.correctInvoice(id, request), id));
    }

    @PatchMapping("/{id}/classification")
    @Operation(summary = "Rattacher une facture a un classement actif")
    public ResponseEntity<InvoiceDetailsResponse> assignClassification(
            @PathVariable Long id,
            @RequestBody InvoiceClassificationRequest request
    ) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.assignClassification(id, request), id));
    }

    @PatchMapping("/{id}/assignee")
    @Operation(
            summary = "Modifier l'affectation d'une facture",
            description = "Affecte la facture a un utilisateur actif ou retire son affectation avec un userId null, puis historise le changement et son auteur"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Affectation modifiee"),
            @ApiResponse(responseCode = "400", description = "Utilisateur inactif ou affectation inchangee"),
            @ApiResponse(responseCode = "404", description = "Facture ou utilisateur introuvable dans l'organisation")
    })
    public ResponseEntity<InvoiceDetailsResponse> assignUser(
            @PathVariable Long id,
            @RequestBody InvoiceAssigneeRequest request
    ) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.assignUser(id, request), id));
    }

    @PostMapping("/{id}/submit-for-validation")
    @Operation(summary = "Soumettre une facture a validation")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Facture soumise a validation"),
            @ApiResponse(
                    responseCode = "409",
                    description = "Transition de statut invalide ou champs obligatoires manquants"
            )
    })
    public ResponseEntity<InvoiceStatusResponse> submitForValidation(@PathVariable Long id) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.submitForValidation(id), id));
    }

    @PostMapping("/{id}/validate")
    @Operation(
            summary = "Valider une facture en attente de decision",
            description = "Passe une facture A_VERIFIER au statut VALIDEE et historise la decision"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Facture validee"),
            @ApiResponse(
                    responseCode = "409",
                    description = "Transition de statut invalide ou champs obligatoires manquants"
            )
    })
    public ResponseEntity<InvoiceStatusResponse> validateInvoice(@PathVariable Long id) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.validateInvoice(id), id));
    }

    @PostMapping("/{id}/request-correction")
    @Operation(
            summary = "Demander une correction au deposant",
            description = "Replace une facture A_VERIFIER dans le circuit de correction et historise le motif"
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Correction demandee"),
            @ApiResponse(responseCode = "400", description = "Motif de correction manquant"),
            @ApiResponse(responseCode = "409", description = "Action interdite pour le statut courant")
    })
    public ResponseEntity<InvoiceStatusResponse> requestInvoiceCorrection(
            @PathVariable Long id,
            @RequestBody InvoiceCorrectionDemandRequest request
    ) {
        return ResponseEntity.ok(requireInvoiceResponse(
                invoiceService.requestInvoiceCorrection(id, request.getReason()),
                id
        ));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Rejeter une facture")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Facture rejetee"),
            @ApiResponse(responseCode = "400", description = "Motif de refus manquant"),
            @ApiResponse(responseCode = "409", description = "Transition de statut invalide")
    })
    public ResponseEntity<InvoiceStatusResponse> rejectInvoice(
            @PathVariable Long id,
            @RequestBody InvoiceRejectionRequest request
    ) {
        return ResponseEntity.ok(requireInvoiceResponse(invoiceService.rejectInvoice(id, request.getReason()), id));
    }

    @PostMapping("/{invoiceId}/duplicate-alerts/{alertId}/decision")
    @Operation(summary = "Decider du traitement d'une alerte de doublon")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Decision enregistree et workflow mis a jour"),
            @ApiResponse(responseCode = "400", description = "Decision ou motif invalide"),
            @ApiResponse(responseCode = "404", description = "Facture ou alerte introuvable"),
            @ApiResponse(responseCode = "409", description = "Alerte deja traitee ou action incompatible")
    })
    public ResponseEntity<InvoiceDetailsResponse> decideDuplicateAlert(
            @PathVariable Long invoiceId,
            @PathVariable Long alertId,
            @RequestBody DuplicateAlertDecisionRequest request
    ) {
        return ResponseEntity.ok(requireInvoiceResponse(
                invoiceService.decideDuplicateAlert(invoiceId, alertId, request),
                invoiceId
        ));
    }

    private <T> T requireInvoiceResponse(Optional<T> response, Long invoiceId) {
        return response.orElseThrow(() -> new InvoiceNotFoundException(invoiceId));
    }
}
