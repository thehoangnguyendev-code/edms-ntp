package com.eqms.config;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserStatus;
import com.eqms.security.AdministrativeNetworkPolicy;
import com.eqms.security.AdministrativeOperationCatalog;
import com.eqms.security.NetworkCidr;
import com.eqms.service.AdministrativeNetworkPolicyService;
import com.eqms.service.AuditTrailService;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
public class AdministrativeNetworkConfig implements WebMvcConfigurer {
    private final AdministrativeNetworkPolicyService policies;
    private final CurrentUserService current;
    private final AuditTrailService audit;
    private final boolean recoveryDisable;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AdministrativeNetworkConfig.class);
    /**
     * @param recoveryDisable server-side recovery switch (APP_ADMIN_NETWORK_RECOVERY_DISABLE=true, then restart): the network policy is ignored so that
     *                        an administrator locked out by a wrong allowlist can get in and correct it. It needs access to the server's environment, not to the application.
     */
    public AdministrativeNetworkConfig(AdministrativeNetworkPolicyService policies, CurrentUserService current, AuditTrailService audit,
                                       @org.springframework.beans.factory.annotation.Value("${app.admin-network.recovery-disable:false}") boolean recoveryDisable) {
        this.policies = policies; this.current = current; this.audit = audit; this.recoveryDisable = recoveryDisable;
        if (recoveryDisable) log.warn("Administrative network restriction is DISABLED by app.admin-network.recovery-disable; remove the setting once the policy is corrected");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                if (!(handler instanceof HandlerMethod method)
                        || !AdministrativeOperationCatalog.isReviewedAdministrativeMethod(method.getBeanType(), method.getMethod().getName())) return true;
                if (recoveryDisable) return true;
                var settings = policies.get();
                if (!settings.enabled()) return true;
                var user = current.requireCurrentUser();
                if (user.getStatus() != UserStatus.Active) throw new AccessDeniedException("Active account required");
                var policy = new AdministrativeNetworkPolicy(true,
                        settings.allowedNetworks().stream().map(NetworkCidr::parse).toList(),
                        settings.trustedProxies().stream().map(NetworkCidr::parse).toList(), settings.emergencyUserId());
                var decision = policy.evaluate(true, user.getId(), true, request.getRemoteAddr(), request.getHeader("X-Forwarded-For"));
                if (decision != AdministrativeNetworkPolicy.Decision.ALLOWED) {
                    audit.logAs(user, "ADMINISTRATIVE_NETWORK_POLICY", "Administrative network access", user.getId(),
                            decision == AdministrativeNetworkPolicy.Decision.DENIED ? "ADMIN_NETWORK_DENIED" : "ADMIN_NETWORK_EMERGENCY_BYPASS",
                            null, null, method.getBeanType().getSimpleName() + "." + method.getMethod().getName());
                }
                if (decision == AdministrativeNetworkPolicy.Decision.DENIED) throw new AccessDeniedException("Administrative access is not allowed from this network");
                return true;
            }
        });
    }
}
