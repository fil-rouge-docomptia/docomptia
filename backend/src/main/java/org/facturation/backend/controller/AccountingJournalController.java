package org.facturation.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import org.facturation.backend.dto.response.AccountingJournalResponse;
import org.facturation.backend.service.AccountingEntryReadService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/accounting-journals")
public class AccountingJournalController {
    private final AccountingEntryReadService accountingEntryReadService;

    public AccountingJournalController(AccountingEntryReadService accountingEntryReadService) {
        this.accountingEntryReadService = accountingEntryReadService;
    }

    @GetMapping
    @Operation(summary = "Consulter les journaux reels de l'organisation, actifs et inactifs")
    public Page<AccountingJournalResponse> listJournals(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination");
        }
        return accountingEntryReadService.findJournals(
                PageRequest.of(page, size, Sort.by("code", "accountingJournalId")));
    }
}
