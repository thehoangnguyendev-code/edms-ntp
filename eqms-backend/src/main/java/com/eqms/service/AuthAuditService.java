package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.entity.AuthAuditLog;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthAuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class AuthAuditService {

    private final AuthAuditLogRepository repository;

    public AuthAuditService(AuthAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(String eventType, UserAccount user, Map<String, Object> details, String ipAddress, String userAgent) {
        AuthAuditLog log = new AuthAuditLog();
        log.setEventType(eventType);
        log.setUser(user);
        log.setDetailsJson(details);
        log.setIpAddress(ipAddress);
        log.setUserAgent(userAgent);
        repository.save(log);
    }

    @Transactional
    public void log(String eventType, AuthenticatedUser principal, Map<String, Object> details, String ipAddress, String userAgent) {
        AuthAuditLog log = new AuthAuditLog();
        log.setEventType(eventType);
        log.setDetailsJson(details);
        log.setIpAddress(ipAddress);
        log.setUserAgent(userAgent);
        repository.save(log);
    }
}
