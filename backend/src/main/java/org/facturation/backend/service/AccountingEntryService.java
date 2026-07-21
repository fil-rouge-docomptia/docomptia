package org.facturation.backend.service;

import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryLine;
import org.facturation.backend.model.Invoice;
import org.facturation.backend.model.User;

import java.util.List;
import java.util.Optional;

public interface AccountingEntryService {

    List<AccountingEntry> findAll();

    Optional<AccountingEntry> findById(Long id);

    AccountingEntry save(AccountingEntry accountingEntry);

    AccountingEntry generateFromInvoice(Invoice invoice, User user);

    Optional<AccountingEntry> findByInvoiceId(Long invoiceId);

    List<AccountingEntryLine> findLines(AccountingEntry accountingEntry);
}
