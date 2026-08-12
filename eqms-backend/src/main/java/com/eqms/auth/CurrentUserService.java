package com.eqms.auth;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;
import java.util.UUID;

@Service
public class CurrentUserService {

    private final UserAccountRepository userAccountRepository;

    public CurrentUserService(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    public AuthenticatedUser requireAuthenticatedPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
            throw new UnauthorizedException("Authentication required");
        }
        return principal;
    }

    public UserAccount requireCurrentUser() {
        return userAccountRepository.findById(requireAuthenticatedPrincipal().userId())
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
    }

    public UserAccount requireCurrentUser(UUID userId) {
        return userAccountRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
    }

    public Optional<UserAccount> findUserById(UUID userId) {
        if (userId == null) {
            return Optional.empty();
        }
        return userAccountRepository.findById(userId);
    }

    public Optional<UserAccount> findUserByUsername(String username) {
        if (!StringUtils.hasText(username)) {
            return Optional.empty();
        }
        return userAccountRepository.findByUsername(username.trim());
    }

    public Optional<UserAccount> findUserByFullName(String fullName) {
        if (!StringUtils.hasText(fullName)) {
            return Optional.empty();
        }
        return userAccountRepository.findByFullNameIgnoreCase(fullName.trim());
    }

    public Optional<UserAccount> findUserByEmail(String email) {
        if (!StringUtils.hasText(email)) {
            return Optional.empty();
        }
        return userAccountRepository.findByEmailIgnoreCase(email.trim());
    }
}
