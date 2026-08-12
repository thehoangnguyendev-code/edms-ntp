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
            user.setMustChangePassword(false);
            user.setMfaEnabled(false);
            user.setCreatedAt(Instant.now());
            user.setUpdatedAt(Instant.now());
            return userRepository.save(user);
        });
    }
}
