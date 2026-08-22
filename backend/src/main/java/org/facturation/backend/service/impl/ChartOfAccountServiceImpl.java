package org.facturation.backend.service.impl;

import org.facturation.backend.dto.request.ChartOfAccountCreateRequest;
import org.facturation.backend.dto.request.ChartOfAccountUpdateRequest;
import org.facturation.backend.dto.response.ChartOfAccountResponse;
import org.facturation.backend.exception.ChartOfAccountConflictException;
import org.facturation.backend.exception.ChartOfAccountNotFoundException;
import org.facturation.backend.exception.InvalidChartOfAccountException;
import org.facturation.backend.mapper.ChartOfAccountResponseMapper;
import org.facturation.backend.model.ChartOfAccount;
import org.facturation.backend.model.Organization;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.ChartOfAccountRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.ChartOfAccountService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class ChartOfAccountServiceImpl implements ChartOfAccountService {

    private static final Long DEFAULT_USER_ID = 1L;

    private final ChartOfAccountRepository chartOfAccountRepository;
    private final ChartOfAccountResponseMapper chartOfAccountResponseMapper;
    private final UserRepository userRepository;

    public ChartOfAccountServiceImpl(
            ChartOfAccountRepository chartOfAccountRepository,
            ChartOfAccountResponseMapper chartOfAccountResponseMapper,
            UserRepository userRepository
    ) {
        this.chartOfAccountRepository = chartOfAccountRepository;
        this.chartOfAccountResponseMapper = chartOfAccountResponseMapper;
        this.userRepository = userRepository;
    }

    @Override
    public List<ChartOfAccount> findAll() {
        return chartOfAccountRepository.findAll();
    }

    @Override
    public Optional<ChartOfAccount> findById(Long id) {
        return chartOfAccountRepository.findById(id);
    }

    @Override
    public ChartOfAccount save(ChartOfAccount chartOfAccount) {
        return chartOfAccountRepository.save(chartOfAccount);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ChartOfAccountResponse> findPage(Pageable pageable) {
        Long organizationId = findCurrentOrganization().getOrganizationId();
        return chartOfAccountRepository.findByOrganizationOrganizationId(organizationId, pageable)
                .map(chartOfAccountResponseMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public ChartOfAccountResponse findDetailsById(Long id) {
        return chartOfAccountResponseMapper.toResponse(findRequiredAccount(id));
    }

    @Override
    @Transactional
    public ChartOfAccountResponse create(ChartOfAccountCreateRequest request) {
        Organization organization = findCurrentOrganization();
        String accountNumber = requireValue(request.getAccountNumber(), "accountNumber");
        ensureAccountNumberAvailable(organization.getOrganizationId(), accountNumber, null);

        LocalDateTime now = LocalDateTime.now();
        ChartOfAccount account = new ChartOfAccount();
        account.setOrganization(organization);
        account.setAccountNumber(accountNumber);
        account.setAccountLabel(requireValue(request.getAccountLabel(), "accountLabel"));
        account.setAccountType(requireValue(request.getAccountType(), "accountType"));
        account.setActive(true);
        account.setCreatedAt(now);
        account.setUpdatedAt(now);
        return chartOfAccountResponseMapper.toResponse(saveWithConflictTranslation(account));
    }

    @Override
    @Transactional
    public ChartOfAccountResponse update(Long id, ChartOfAccountUpdateRequest request) {
        ChartOfAccount account = findRequiredAccount(id);
        boolean changed = false;

        if (request.getAccountNumber() != null) {
            String accountNumber = requireValue(request.getAccountNumber(), "accountNumber");
            if (!Objects.equals(account.getAccountNumber(), accountNumber)) {
                ensureAccountNumberAvailable(account.getOrganization().getOrganizationId(), accountNumber, id);
                account.setAccountNumber(accountNumber);
                changed = true;
            }
        }
        changed |= applyValue(
                request.getAccountLabel(),
                account.getAccountLabel(),
                account::setAccountLabel,
                "accountLabel"
        );
        changed |= applyValue(
                request.getAccountType(),
                account.getAccountType(),
                account::setAccountType,
                "accountType"
        );
        if (!changed) {
            throw new InvalidChartOfAccountException("At least one changed field is required");
        }

        account.setUpdatedAt(LocalDateTime.now());
        return chartOfAccountResponseMapper.toResponse(saveWithConflictTranslation(account));
    }

    @Override
    @Transactional
    public ChartOfAccountResponse deactivate(Long id) {
        ChartOfAccount account = findRequiredAccount(id);
        if (!account.isActive()) {
            throw new InvalidChartOfAccountException("Account is already inactive");
        }
        account.setActive(false);
        account.setUpdatedAt(LocalDateTime.now());
        return chartOfAccountResponseMapper.toResponse(chartOfAccountRepository.save(account));
    }

    private ChartOfAccount findRequiredAccount(Long id) {
        Long organizationId = findCurrentOrganization().getOrganizationId();
        return chartOfAccountRepository.findByAccountIdAndOrganizationOrganizationId(id, organizationId)
                .orElseThrow(() -> new ChartOfAccountNotFoundException(id));
    }

    private void ensureAccountNumberAvailable(Long organizationId, String accountNumber, Long excludedAccountId) {
        boolean exists = excludedAccountId == null
                ? chartOfAccountRepository.existsByOrganizationOrganizationIdAndAccountNumber(organizationId, accountNumber)
                : chartOfAccountRepository.existsByOrganizationOrganizationIdAndAccountNumberAndAccountIdNot(
                        organizationId,
                        accountNumber,
                        excludedAccountId
                );
        if (exists) {
            throw new ChartOfAccountConflictException(accountNumber);
        }
    }

    private ChartOfAccount saveWithConflictTranslation(ChartOfAccount account) {
        try {
            return chartOfAccountRepository.saveAndFlush(account);
        } catch (DataIntegrityViolationException exception) {
            throw new ChartOfAccountConflictException(account.getAccountNumber());
        }
    }

    private boolean applyValue(
            String requestedValue,
            String currentValue,
            java.util.function.Consumer<String> setter,
            String fieldName
    ) {
        if (requestedValue == null) {
            return false;
        }
        String value = requireValue(requestedValue, fieldName);
        if (Objects.equals(currentValue, value)) {
            return false;
        }
        setter.accept(value);
        return true;
    }

    private String requireValue(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new InvalidChartOfAccountException(fieldName + " is required");
        }
        return value.trim();
    }

    private Organization findCurrentOrganization() {
        User currentUser = userRepository.findById(DEFAULT_USER_ID)
                .orElseThrow(() -> new IllegalStateException("Default user not found"));
        return currentUser.getOrganization();
    }
}
