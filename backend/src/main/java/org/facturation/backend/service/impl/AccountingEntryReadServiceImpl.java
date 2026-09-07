package org.facturation.backend.service.impl;

import org.facturation.backend.dto.response.AccountingEntryReadResponse;
import org.facturation.backend.exception.AccountingEntryNotFoundException;
import org.facturation.backend.mapper.AccountingEntryMapper;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryStatusCode;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.facturation.backend.repository.AccountingEntryLineRepository;
import org.facturation.backend.service.AccountingEntryReadService;
import org.facturation.backend.service.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class AccountingEntryReadServiceImpl implements AccountingEntryReadService {
    private final AccountingEntryRepository entries;
    private final AccountingEntryLineRepository lines;
    private final AccountingEntryMapper mapper;
    private final CurrentUserService currentUserService;

    public AccountingEntryReadServiceImpl(AccountingEntryRepository entries, AccountingEntryLineRepository lines,
            AccountingEntryMapper mapper, CurrentUserService currentUserService) {
        this.entries = entries;
        this.lines = lines;
        this.mapper = mapper;
        this.currentUserService = currentUserService;
    }

    @Override
    public Page<AccountingEntryReadResponse> findPage(String query, Boolean balanced,
            AccountingEntryStatusCode status, Pageable pageable) {
        return entries.findReadPage(organizationId(), query.trim().toLowerCase(Locale.ROOT),
                balanced, status == null ? null : status.getCode(), pageable).map(this::toResponse);
    }

    @Override
    public AccountingEntryReadResponse findDetails(Long id) {
        return toResponse(entries.findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(id, organizationId())
                .orElseThrow(() -> new AccountingEntryNotFoundException(id)));
    }

    private Long organizationId() {
        return currentUserService.getCurrentUser().getOrganization().getOrganizationId();
    }

    private AccountingEntryReadResponse toResponse(AccountingEntry entry) {
        Invoice invoice = entry.getInvoice();
        return new AccountingEntryReadResponse(invoice.getInvoiceId(), invoice.getInvoiceNumber(),
                invoice.getSupplier() == null ? null : invoice.getSupplier().getLegalName(),
                invoice.getCurrencyCode(), invoice.getInvoiceStatus().getCode(),
                mapper.toResponse(entry, lines.findByAccountingEntryAccountingEntryIdOrderByLineNumberAsc(
                        entry.getAccountingEntryId())));
    }
}
