package org.facturation.backend.service;

import org.facturation.backend.dto.request.AccountingExportSelectionRequest;
import org.facturation.backend.dto.request.AccountingExportPreflightRequest;
import org.facturation.backend.dto.response.AccountingExportPreflightResponse;
import org.facturation.backend.dto.response.AccountingExportHistoryResponse;
import org.facturation.backend.dto.response.AccountingExportSelectionResponse;
import org.facturation.backend.dto.response.AccountingExportSelectionResponse.Candidate;
import org.facturation.backend.dto.response.AccountingExportSelectionResponse.Totals;
import org.facturation.backend.dto.response.AccountingExportSummaryResponse;
import org.facturation.backend.dto.response.AccountingExportControlErrorResponse;
import org.facturation.backend.dto.response.InvoiceExportErrorResponse;
import org.facturation.backend.exception.AccountingExportValidationException;
import org.facturation.backend.model.ExportBatch;
import org.facturation.backend.model.ExportBatchFormat;
import org.facturation.backend.model.ExportBatchStatusCode;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.Organization;
import org.facturation.backend.repository.ExportBatchRepository;
import org.facturation.backend.repository.InvoiceRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class AccountingExportReadService {
    private final CurrentUserService currentUser;
    private final InvoiceRepository invoices;
    private final ExportBatchRepository batches;
    private final AccountingExportValidator validator;

    public AccountingExportReadService(CurrentUserService currentUser, InvoiceRepository invoices,
            ExportBatchRepository batches, AccountingExportValidator validator) {
        this.currentUser = currentUser;
        this.invoices = invoices;
        this.batches = batches;
        this.validator = validator;
    }

    public Page<AccountingExportHistoryResponse> history(String query, ExportBatchStatusCode status,
            ExportBatchFormat format, LocalDate startDate, LocalDate endDate, int page, int size) {
        validatePeriod(startDate, endDate);
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException("Page must be non-negative and size between 1 and 100");
        }
        LocalDate fallback = LocalDate.of(1970, 1, 1);
        return batches.findHistory(organization().getOrganizationId(), query.trim().toLowerCase(Locale.ROOT),
                status == null ? null : status.getCode(), format == null ? null : format.name(),
                startDate != null, (startDate == null ? fallback : startDate).atStartOfDay(),
                endDate != null, (endDate == null ? fallback : endDate).plusDays(1).atStartOfDay(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "exportBatchId")))
                .map(this::historyItem);
    }

    public AccountingExportSummaryResponse summary() {
        Organization organization = organization();
        List<Candidate> candidates = candidates(organization, null, null).stream().map(this::candidate).toList();
        long ready = candidates.stream().filter(Candidate::eligible).count();
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        return new AccountingExportSummaryResponse(ready, candidates.size() - ready,
                batches.countByOrganizationOrganizationIdAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThan(
                        organization.getOrganizationId(), monthStart.atStartOfDay(),
                        monthStart.plusMonths(1).atStartOfDay()), monthStart, monthStart.plusMonths(1).minusDays(1));
    }

    public AccountingExportSelectionResponse selection(LocalDate startDate, LocalDate endDate) {
        validatePeriod(startDate, endDate);
        Organization organization = organization();
        return selectionResponse(organization, startDate, endDate,
                candidates(organization, startDate, endDate).stream().map(this::candidate).toList());
    }

    public AccountingExportSelectionResponse confirm(AccountingExportSelectionRequest request) {
        Organization organization = organization();
        List<Candidate> checked = selectedInvoices(organization, request).stream().map(this::candidate).toList();
        List<InvoiceExportErrorResponse> errors = checked.stream().filter(item -> !item.eligible())
                .map(item -> new InvoiceExportErrorResponse(item.invoiceId(), item.invoiceNumber(), item.errors()))
                .toList();
        if (!errors.isEmpty()) {
            throw new AccountingExportValidationException(errors);
        }
        return selectionResponse(organization, request.startDate(), request.endDate(), checked);
    }

    public AccountingExportPreflightResponse preflight(AccountingExportPreflightRequest request) {
        if (request.format() == null) {
            throw new IllegalArgumentException("Select an export format");
        }
        Organization organization = organization();
        List<Invoice> selected = selectedInvoices(organization, new AccountingExportSelectionRequest(
                request.startDate(), request.endDate(), request.invoiceIds()));
        var entries = request.format() == ExportBatchFormat.FEC
                ? validator.validateForFec(selected) : validator.validate(selected);
        List<Candidate> checked = entries.stream().map(item -> candidate(item.entry().getInvoice(), item)).toList();
        return new AccountingExportPreflightResponse(request.format(),
                selectionResponse(organization, request.startDate(), request.endDate(), checked));
    }

    private List<Invoice> selectedInvoices(Organization organization, AccountingExportSelectionRequest request) {
        validatePeriod(request.startDate(), request.endDate());
        if (request.invoiceIds() == null || request.invoiceIds().isEmpty()
                || request.invoiceIds().stream().anyMatch(id -> id == null || id <= 0)
                || new HashSet<>(request.invoiceIds()).size() != request.invoiceIds().size()) {
            throw new IllegalArgumentException("Select at least one invoice, with unique positive identifiers");
        }
        var requestedIds = new HashSet<>(request.invoiceIds());
        List<Invoice> selected = candidates(organization, request.startDate(), request.endDate()).stream()
                .filter(invoice -> requestedIds.contains(invoice.getInvoiceId())).toList();
        if (selected.size() != requestedIds.size()) {
            // Do not reveal whether an unavailable ID belongs to another organization.
            throw new AccountingExportValidationException(List.of(new InvoiceExportErrorResponse(null, null,
                    List.of(new AccountingExportControlErrorResponse("SELECTION_CHANGED",
                            "One or more selected invoices are no longer available in this period")))));
        }
        return selected;
    }

    private Organization organization() {
        return currentUser.getCurrentUser().getOrganization();
    }

    private void validatePeriod(LocalDate start, LocalDate end) {
        if (start != null && end != null && start.isAfter(end)) {
            throw new IllegalArgumentException("Start date must be on or before end date");
        }
    }

    private List<Invoice> candidates(Organization organization, LocalDate start, LocalDate end) {
        LocalDate fallback = LocalDate.of(1970, 1, 1);
        return invoices.findAccountingExportCandidates(organization.getOrganizationId(),
                start != null, start == null ? fallback : start, end != null, end == null ? fallback : end);
    }

    private Candidate candidate(Invoice invoice) {
        try {
            return candidate(invoice, validator.validate(List.of(invoice)).getFirst());
        } catch (AccountingExportValidationException exception) {
            return new Candidate(invoice.getInvoiceId(), invoice.getInvoiceNumber(), invoice.getInvoiceDate(),
                    invoice.getSupplier() == null ? null : invoice.getSupplier().getLegalName(),
                    invoice.getCurrencyCode(), invoice.getTotalTtc(), false, null, null,
                    exception.getInvoiceErrors().getFirst().errors());
        }
    }

    private Candidate candidate(Invoice invoice, AccountingExportValidator.ValidatedEntry entry) {
        BigDecimal debit = entry.lines().stream().map(line -> amount(line.getDebitAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal credit = entry.lines().stream().map(line -> amount(line.getCreditAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new Candidate(invoice.getInvoiceId(), invoice.getInvoiceNumber(), invoice.getInvoiceDate(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getLegalName(),
                invoice.getCurrencyCode(), invoice.getTotalTtc(), true, debit, credit, List.of());
    }

    private AccountingExportSelectionResponse selectionResponse(Organization organization, LocalDate start,
            LocalDate end, List<Candidate> candidates) {
        Map<String, Totals> totals = new LinkedHashMap<>();
        for (Candidate item : candidates) {
            if (item.eligible()) {
                Totals previous = totals.getOrDefault(item.currencyCode(),
                        new Totals(item.currencyCode(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
                totals.put(item.currencyCode(), new Totals(item.currencyCode(),
                        previous.totalDebit().add(item.totalDebit()), previous.totalCredit().add(item.totalCredit()),
                        previous.invoiceAmount().add(item.invoiceAmount())));
            }
        }
        return new AccountingExportSelectionResponse(organization.getOrganizationId(), organization.getName(),
                start, end, candidates, List.copyOf(totals.values()));
    }

    private AccountingExportHistoryResponse historyItem(ExportBatch batch) {
        Map<String, BigDecimal> amounts = new LinkedHashMap<>();
        for (Invoice invoice : batch.getInvoices()) {
            amounts.merge(invoice.getCurrencyCode(), amount(invoice.getTotalTtc()), BigDecimal::add);
        }
        var user = batch.getCreatedByUser();
        return new AccountingExportHistoryResponse(batch.getExportBatchId(), batch.getCreatedAt(),
                batch.getPeriodStartDate(), batch.getPeriodEndDate(), batch.getFormat(), batch.getStatus(),
                batch.getFileName(), user.getFirstName() + " " + user.getLastName(), batch.getInvoices().size(),
                amounts.entrySet().stream()
                        .map(item -> new AccountingExportHistoryResponse.Amount(item.getKey(), item.getValue()))
                        .toList(),
                batch.getFileName() != null && batch.getFilePath() != null
                        && (ExportBatchStatusCode.GENERE.getCode().equals(batch.getStatus())
                        || ExportBatchStatusCode.ARCHIVE.getCode().equals(batch.getStatus())));
    }

    private BigDecimal amount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
