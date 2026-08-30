package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.InvoiceAccountingEntryResponse;
import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceStatusResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceStatusCode;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.facturation.backend.service.InvoiceDuplicateAlertService;
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
    private final ClassificationResponseMapper classificationResponseMapper;

    public InvoiceResponseMapper(
            InvoiceFileRepository invoiceFileRepository,
            InvoiceOcrService invoiceOcrService,
            OcrErrorService ocrErrorService,
            OcrErrorMapper ocrErrorMapper,
            AccountingEntryService accountingEntryService,
            AccountingEntryMapper accountingEntryMapper,
            InvoiceDuplicateAlertService duplicateAlertService,
            ClassificationResponseMapper classificationResponseMapper
    ) {
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceOcrService = invoiceOcrService;
        this.ocrErrorService = ocrErrorService;
        this.ocrErrorMapper = ocrErrorMapper;
        this.accountingEntryService = accountingEntryService;
        this.accountingEntryMapper = accountingEntryMapper;
        this.duplicateAlertService = duplicateAlertService;
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
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setSupplierName(extractSupplierName(invoice));
        response.setCurrencyCode(invoice.getCurrencyCode());
        response.setTotalHt(toStringOrNull(invoice.getTotalHt()));
        response.setTotalTva(toStringOrNull(invoice.getTotalTva()));
        response.setTotalTtc(toStringOrNull(invoice.getTotalTtc()));
        response.setDuplicateAlerts(duplicateAlertService.findByInvoiceId(invoice.getInvoiceId()));
        if (invoice.getClassification() != null) {
            response.setClassification(classificationResponseMapper.toResponse(invoice.getClassification()));
        }

        invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId())
                .ifPresent(invoiceFile -> response.setFilePath(invoiceFile.getFilePath()));

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

        return response;
    }

    private String extractSupplierName(Invoice invoice) {
        return invoice.getSupplier() == null ? null : invoice.getSupplier().getName();
    }

    private String toStringOrNull(BigDecimal value) {
        return value == null ? null : value.toString();
    }
}
