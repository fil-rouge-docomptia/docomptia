package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceAssigneeResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.InvoiceSupplierResponse;
import org.facturation.backend.dto.response.LegalRetentionMetadataResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
import org.facturation.backend.service.InvoiceHistoryService;
import org.facturation.backend.service.InvoiceOcrService;
import org.facturation.backend.service.OcrErrorService;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
public class InvoiceResponseMapper {

    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceOcrService invoiceOcrService;
    private final OcrErrorService ocrErrorService;
    private final OcrErrorMapper ocrErrorMapper;
    private final AccountingEntryService accountingEntryService;
    private final AccountingEntryMapper accountingEntryMapper;
    private final InvoiceDuplicateAlertService duplicateAlertService;
    private final InvoiceHistoryService invoiceHistoryService;
    private final ClassificationResponseMapper classificationResponseMapper;

    public InvoiceResponseMapper(
            InvoiceFileRepository invoiceFileRepository,
            InvoiceOcrService invoiceOcrService,
            OcrErrorService ocrErrorService,
            OcrErrorMapper ocrErrorMapper,
            AccountingEntryService accountingEntryService,
            AccountingEntryMapper accountingEntryMapper,
            InvoiceDuplicateAlertService duplicateAlertService,
            InvoiceHistoryService invoiceHistoryService,
            ClassificationResponseMapper classificationResponseMapper
    ) {
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceOcrService = invoiceOcrService;
        this.ocrErrorService = ocrErrorService;
        this.ocrErrorMapper = ocrErrorMapper;
        this.accountingEntryService = accountingEntryService;
        this.accountingEntryMapper = accountingEntryMapper;
        this.duplicateAlertService = duplicateAlertService;
        this.invoiceHistoryService = invoiceHistoryService;
        this.classificationResponseMapper = classificationResponseMapper;
    }

    public InvoiceUploadResponse toUploadResponse(Invoice invoice, OcrAnalysisResponse ocrAnalysis) {
        InvoiceUploadResponse response = new InvoiceUploadResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setOcrAnalysis(ocrAnalysis);
        response.setDuplicateAlerts(duplicateAlertService.findByInvoiceId(invoice.getInvoiceId()));
        return response;
    }

    public InvoiceListItemResponse toListItemResponse(Invoice invoice) {
        InvoiceListItemResponse response = new InvoiceListItemResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setInvoiceDate(invoice.getInvoiceDate() == null ? null : invoice.getInvoiceDate().toString());
        response.setDueDate(invoice.getDueDate() == null ? null : invoice.getDueDate().toString());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setSupplierName(extractSupplierName(invoice));
        response.setCurrencyCode(invoice.getCurrencyCode());
        response.setTotalTtc(toStringOrNull(invoice.getTotalTtc()));
        return response;
    }

    public InvoiceStatusResponse toStatusResponse(Invoice invoice) {
        InvoiceStatusResponse response = new InvoiceStatusResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        return response;
    }

    public InvoiceAccountingEntryResponse toAccountingEntryResponse(
            Invoice invoice,
            AccountingEntry accountingEntry
    ) {
        InvoiceAccountingEntryResponse response = new InvoiceAccountingEntryResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setAccountingEntry(accountingEntryMapper.toResponse(
                accountingEntry,
                accountingEntryService.findLines(accountingEntry)
        ));
        return response;
    }

    public InvoiceDetailsResponse toDetailsResponse(Invoice invoice) {
        InvoiceDetailsResponse response = new InvoiceDetailsResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setCommandReference(invoice.getCommandReference());
        response.setInvoiceDate(invoice.getInvoiceDate() == null ? null : invoice.getInvoiceDate().toString());
        response.setDueDate(invoice.getDueDate() == null ? null : invoice.getDueDate().toString());
        response.setPaymentDate(invoice.getPaymentDate() == null ? null : invoice.getPaymentDate().toString());
        response.setPaymentReference(invoice.getPaymentReference());
        if (invoice.getPaidByUser() != null) {
            response.setPaidByUserId(invoice.getPaidByUser().getUserId());
        }
        response.setArchivedAt(invoice.getArchivedAt() == null ? null : invoice.getArchivedAt().toString());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setSupplierName(extractSupplierName(invoice));
        if (invoice.getSupplier() != null) {
            response.setSupplier(new InvoiceSupplierResponse(
                    invoice.getSupplier().getSupplierId(), invoice.getSupplier().getLegalName(),
                    invoice.getSupplier().getName(), invoice.getSupplier().getCountryCode(),
                    invoice.getSupplierLegalNameSnapshot(), invoice.getSupplierAddressSnapshot(),
                    invoice.getSupplierIdentifiersSnapshot(), Boolean.TRUE.equals(invoice.getSupplierMatchConfirmed())));
        }
        response.setCurrencyCode(invoice.getCurrencyCode());
        response.setTotalHt(toStringOrNull(invoice.getTotalHt()));
        response.setTotalTva(toStringOrNull(invoice.getTotalTva()));
        response.setTotalTtc(toStringOrNull(invoice.getTotalTtc()));
        response.setDuplicateAlerts(duplicateAlertService.findByInvoiceId(invoice.getInvoiceId()));
        response.setHistory(invoiceHistoryService.findByInvoiceId(invoice.getInvoiceId()));
        if (invoice.getClassification() != null) {
            response.setClassification(classificationResponseMapper.toResponse(invoice.getClassification()));
        }
        if (invoice.getAssignedUser() != null) {
            response.setAssignee(new InvoiceAssigneeResponse(
                    invoice.getAssignedUser().getUserId(),
                    invoice.getAssignedUser().getFirstName(),
                    invoice.getAssignedUser().getLastName(),
                    invoice.getAssignedUser().getEmail()
            ));
        }

        invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId()).ifPresent(invoiceFile -> {
            response.setFilePath(invoiceFile.getFilePath());
            if (invoiceFile.getArchivedAt() != null) {
                response.setLegalRetentionMetadata(new LegalRetentionMetadataResponse(
                        invoiceFile.getInvoiceFileId(),
                        invoiceFile.getArchivedAt().toString(),
                        invoiceFile.getRetentionDurationYears(),
                        invoiceFile.getIntegrityStatus() == null ? null : invoiceFile.getIntegrityStatus().name(),
                        invoiceFile.getFilePath()
                ));
            }
        });

        invoiceOcrService.findLatestAnalysisResponse(invoice.getInvoiceId())
                .ifPresent(response::setOcrAnalysis);

        if (InvoiceStatusCode.ERREUR_OCR.getCode().equals(invoice.getInvoiceStatus().getCode())) {
            ocrErrorService.findLatestByInvoiceId(invoice.getInvoiceId())
                    .map(ocrErrorMapper::toResponse)
                    .ifPresent(response::setOcrError);
        }

        accountingEntryService.findByInvoiceId(invoice.getInvoiceId())
                .ifPresent(accountingEntry -> response.setAccountingEntry(accountingEntryMapper.toResponse(
                        accountingEntry,
                        accountingEntryService.findLines(accountingEntry)
                )));
        response.setAccountingEntries(accountingEntryService.findAllByInvoiceId(invoice.getInvoiceId()).stream()
                .map(accountingEntry -> accountingEntryMapper.toResponse(
                        accountingEntry,
                        accountingEntryService.findLines(accountingEntry)
                ))
                .toList());

        return response;
    }

    private String extractSupplierName(Invoice invoice) {
        return invoice.getSupplier() == null ? null : invoice.getSupplier().getName();
    }

    private String toStringOrNull(BigDecimal value) {
        return value == null ? null : value.toString();
    }
}
