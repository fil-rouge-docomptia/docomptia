package org.facturation.backend.mapper;

import org.facturation.backend.dto.response.InvoiceDetailsResponse;
import org.facturation.backend.dto.response.InvoiceListItemResponse;
import org.facturation.backend.dto.response.InvoiceUploadResponse;
import org.facturation.backend.dto.response.OcrAnalysisResponse;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.InvoiceFile;
import org.facturation.backend.repository.InvoiceFileRepository;
import org.facturation.backend.service.AccountingEntryService;
import org.facturation.backend.service.InvoiceOcrService;
import org.springframework.stereotype.Component;

@Component
public class InvoiceResponseMapper {

    private final InvoiceFileRepository invoiceFileRepository;
    private final InvoiceOcrService invoiceOcrService;
    private final AccountingEntryService accountingEntryService;
    private final AccountingEntryMapper accountingEntryMapper;

    public InvoiceResponseMapper(
            InvoiceFileRepository invoiceFileRepository,
            InvoiceOcrService invoiceOcrService,
            AccountingEntryService accountingEntryService,
            AccountingEntryMapper accountingEntryMapper
    ) {
        this.invoiceFileRepository = invoiceFileRepository;
        this.invoiceOcrService = invoiceOcrService;
        this.accountingEntryService = accountingEntryService;
        this.accountingEntryMapper = accountingEntryMapper;
    }

    public InvoiceUploadResponse toUploadResponse(
            Invoice invoice,
            InvoiceFile invoiceFile,
            OcrAnalysisResponse ocrAnalysis
    ) {
        InvoiceUploadResponse response = new InvoiceUploadResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setFilePath(invoiceFile.getFilePath());
        response.setOcrAnalysis(ocrAnalysis);
        return response;
    }

    public InvoiceListItemResponse toListItemResponse(Invoice invoice) {
        InvoiceListItemResponse response = new InvoiceListItemResponse();
        response.setInvoiceId(invoice.getInvoiceId());
        response.setInvoiceNumber(invoice.getInvoiceNumber());
        response.setCommandReference(invoice.getCommandReference());
        response.setInvoiceDate(invoice.getInvoiceDate() == null ? null : invoice.getInvoiceDate().toString());
        response.setDueDate(invoice.getDueDate() == null ? null : invoice.getDueDate().toString());
        response.setStatus(invoice.getInvoiceStatus().getCode());
        response.setSupplierName(invoice.getSupplier().getName());
        response.setCurrencyCode(invoice.getCurrencyCode());
        response.setTotalHt(invoice.getTotalHt().toString());
        response.setTotalTva(invoice.getTotalTva().toString());
        response.setTotalTtc(invoice.getTotalTtc().toString());
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
        response.setSupplierName(invoice.getSupplier().getName());
        response.setCurrencyCode(invoice.getCurrencyCode());
        response.setTotalHt(invoice.getTotalHt().toString());
        response.setTotalTva(invoice.getTotalTva().toString());
        response.setTotalTtc(invoice.getTotalTtc().toString());

        invoiceFileRepository.findByInvoiceInvoiceId(invoice.getInvoiceId())
                .ifPresent(invoiceFile -> response.setFilePath(invoiceFile.getFilePath()));

        invoiceOcrService.findLatestAnalysisResponse(invoice.getInvoiceId())
                .ifPresent(response::setOcrAnalysis);

        accountingEntryService.findByInvoiceId(invoice.getInvoiceId())
                .ifPresent(accountingEntry -> response.setAccountingEntry(accountingEntryMapper.toResponse(
                        accountingEntry,
                        accountingEntryService.findLines(accountingEntry)
                )));

        return response;
    }
}
