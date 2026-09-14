package org.facturation.backend.service;

import jakarta.persistence.EntityManager;
import org.facturation.backend.dto.request.AccountingEntryLineCorrectionRequest;
import org.facturation.backend.exception.AccountingEntryMutationConflictException;
import org.facturation.backend.exception.AccountingEntryNotFoundException;
import org.facturation.backend.exception.InvalidAccountingEntryLineCorrectionException;
import org.facturation.backend.model.AccountingEntry;
import org.facturation.backend.model.AccountingEntryMutation;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.AccountingEntryMutationRepository;
import org.facturation.backend.repository.AccountingEntryRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;

@Service
public class AccountingEntryMutationGuard {
    private final AccountingPieceNumberService numbering;
    private final AccountingEntryRepository entries;
    private final AccountingEntryMutationRepository mutations;
    private final EntityManager entityManager;

    public AccountingEntryMutationGuard(AccountingPieceNumberService numbering, AccountingEntryRepository entries,
            AccountingEntryMutationRepository mutations, EntityManager entityManager) {
        this.numbering = numbering;
        this.entries = entries;
        this.mutations = mutations;
        this.entityManager = entityManager;
    }

    public Mutation begin(User user, Long entryId, Long lineId, String action,
            AccountingEntryLineCorrectionRequest request, String ifMatch, String key) {
        Long version = parseVersion(ifMatch);
        if (key != null && (version == null || !validKey(key))) {
            throw new InvalidAccountingEntryLineCorrectionException("Idempotency-Key must be a UUID and requires If-Match");
        }
        // The same organization lock serializes line changes with CSV/FEC export.
        entityManager.flush();
        numbering.lockSequence(user.getOrganization().getOrganizationId());
        AccountingEntry entry = entries.findByAccountingEntryIdAndInvoiceOrganizationOrganizationId(
                entryId, user.getOrganization().getOrganizationId())
                .orElseThrow(() -> new AccountingEntryNotFoundException(entryId));
        entityManager.refresh(entry);
        entityManager.refresh(entry.getInvoice());
        String fingerprint = fingerprint(user, lineId, action, request, version);
        if (key != null) {
            var previous = mutations.findByAccountingEntryAccountingEntryIdAndRequestKey(entryId, key);
            if (previous.isPresent()) {
                if (!previous.get().getFingerprint().equals(fingerprint)) {
                    throw new AccountingEntryMutationConflictException("Idempotency key already used");
                }
                return new Mutation(entry, key, fingerprint, true);
            }
        }
        if (version != null && !Objects.equals(version, entry.getVersion())) {
            throw new AccountingEntryMutationConflictException("Stale accounting entry version");
        }
        return new Mutation(entry, key, fingerprint, false);
    }

    public void complete(Mutation mutation) {
        if (mutation.key() != null) {
            AccountingEntryMutation receipt = new AccountingEntryMutation();
            receipt.setAccountingEntry(mutation.entry());
            receipt.setRequestKey(mutation.key());
            receipt.setFingerprint(mutation.fingerprint());
            mutations.save(receipt);
        }
        entityManager.flush();
    }

    private Long parseVersion(String ifMatch) {
        if (ifMatch == null) return null;
        String value = ifMatch.matches("\"[0-9]+\"") ? ifMatch.substring(1, ifMatch.length() - 1) : ifMatch;
        try {
            if (!value.matches("[0-9]+")) throw new NumberFormatException();
            return Long.valueOf(value);
        } catch (NumberFormatException exception) {
            throw new InvalidAccountingEntryLineCorrectionException("If-Match must contain the non-negative entry version");
        }
    }

    private boolean validKey(String key) {
        try { return UUID.fromString(key).toString().equals(key); }
        catch (IllegalArgumentException exception) { return false; }
    }

    private String fingerprint(User user, Long lineId, String action,
            AccountingEntryLineCorrectionRequest request, Long version) {
        Object[] values = {user.getUserId(), lineId, action, version,
                request == null ? null : request.getAccountId(), request == null ? null : request.getLineLabel(),
                request == null ? null : request.getDebitAmount(), request == null ? null : request.getCreditAmount(),
                request == null ? null : request.hasVatRate(), request == null ? null : request.getVatRate(),
                request == null ? null : request.hasClassification(), request == null ? null : request.getClassificationId()};
        StringBuilder canonical = new StringBuilder();
        for (Object value : values) {
            if (value == null) {
                canonical.append("-1:");
            } else {
                String text = value.toString();
                canonical.append(text.length()).append(':').append(text);
            }
        }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public record Mutation(AccountingEntry entry, String key, String fingerprint, boolean replay) { }
}
