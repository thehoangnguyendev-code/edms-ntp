package com.eqms.bootstrap;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Component
@Order(1)
public class AuthBootstrap implements ApplicationRunner {

    private final UserAccountRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthBootstrap(UserAccountRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        userRepository.findByUsername("admin").orElseGet(() -> {
            UserAccount user = new UserAccount();
            user.setUsername("admin");
            user.setEmail("admin@example.com");
            user.setEmployeeCode("EMP-0001");
            user.setFullName("System Administrator");
            user.setPasswordHash(passwordEncoder.encode("Admin@123"));
            user.setRoleName("SuperAdmin");
            user.setDepartment("Quality Assurance");
            user.setPosition("Administrator");
            user.setStatus(UserStatus.Active);
            // The first administrator of a new installation starts with a password that is written in the source, so it must be replaced at the first sign-in
            // (21 CFR 11.300 / EU-GMP Annex 11 12.1: a credential that everyone who has read the code knows is not a unique identity). DEC-AUTHZ-2026-11-21-05.
            user.setMustChangePassword(true);
            user.setMfaEnabled(false);
            user.setCreatedAt(Instant.now());
            user.setUpdatedAt(Instant.now());
            return userRepository.save(user);
        });
    }
}
