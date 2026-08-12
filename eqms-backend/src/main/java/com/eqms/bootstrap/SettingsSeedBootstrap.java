package com.eqms.bootstrap;

import com.eqms.entity.DocumentWorkflowPoolMember;
import com.eqms.entity.DocumentWorkflowSetting;
import com.eqms.entity.Permission;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.RolePermission;
import com.eqms.entity.RolePermissionId;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserCertification;
import com.eqms.entity.UserEducation;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentWorkflowPoolMemberRepository;
import com.eqms.repository.DocumentWorkflowSettingRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.RolePermissionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.UserCertificationRepository;
import com.eqms.repository.UserEducationRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Component
@Order(2)
public class SettingsSeedBootstrap implements ApplicationRunner {

    private static final String DEFAULT_PASSWORD = "Temp@1234";
    private static final Logger log = LoggerFactory.getLogger(SettingsSeedBootstrap.class);

    private final UserAccountRepository userRepository;
    private final UserEducationRepository educationRepository;
    private final UserCertificationRepository certificationRepository;
    private final RoleDefinitionRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final DocumentWorkflowSettingRepository workflowSettingRepository;
    private final DocumentWorkflowPoolMemberRepository poolMemberRepository;
    private final PasswordEncoder passwordEncoder;

    public SettingsSeedBootstrap(
            UserAccountRepository userRepository,
            UserEducationRepository educationRepository,
            UserCertificationRepository certificationRepository,
            RoleDefinitionRepository roleRepository,
            PermissionRepository permissionRepository,
            RolePermissionRepository rolePermissionRepository,
            DocumentWorkflowSettingRepository workflowSettingRepository,
            DocumentWorkflowPoolMemberRepository poolMemberRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.educationRepository = educationRepository;
        this.certificationRepository = certificationRepository;
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.rolePermissionRepository = rolePermissionRepository;
        this.workflowSettingRepository = workflowSettingRepository;
        this.poolMemberRepository = poolMemberRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            ensureAdminUser();
            seedRoles();
            seedUsers();
            seedEducationAndCertifications();
            seedDocumentAdministration();
        } catch (Exception ex) {
            log.warn("Settings seed bootstrap skipped due to startup error: {}", ex.getMessage(), ex);
        }
    }

    private void ensureAdminUser() {
        userRepository.findByUsername("admin")
                .or(() -> userRepository.findByEmail("admin@example.com"))
                .orElseGet(() -> {
            UserAccount user = new UserAccount();
            user.setUsername("admin");
            user.setEmail("admin@example.com");
            user.setEmployeeCode("NTP.0001");
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

    private void seedRoles() {
        for (SeedRoleSpec spec : roleSeeds()) {
            RoleDefinition role = roleRepository.findByName(spec.name()).orElseGet(() -> createRole(spec));
            ensureRolePermissions(role, spec.permissions());
        }
    }

    private RoleDefinition createRole(SeedRoleSpec spec) {
        RoleDefinition role = new RoleDefinition();
        role.setCode(spec.code());
        role.setName(spec.name());
        role.setDescription(spec.description());
        role.setSystem(spec.system());
        role.setActive(spec.active());
        role.setCreatedAt(Instant.now());
        role.setUpdatedAt(Instant.now());
        return roleRepository.save(role);
    }

    private void ensureRolePermissions(RoleDefinition role, List<String> permissionCodes) {
        if (permissionCodes == null || permissionCodes.isEmpty()) {
            return;
        }

        var existingCodes = rolePermissionRepository.findAllByRole_Id(role.getId()).stream()
                .map(rolePermission -> rolePermission.getPermission() == null ? null : rolePermission.getPermission().getCode())
                .filter(this::hasText)
                .map(code -> code.trim().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());

        for (String code : permissionCodes.stream().filter(this::hasText).distinct().toList()) {
            String normalizedCode = code.trim().toLowerCase(Locale.ROOT);
            if (existingCodes.contains(normalizedCode)) {
                continue;
            }
            Permission permission = permissionRepository.findByCode(code)
                    .orElse(null);
            if (permission == null) {
                log.warn("Skipping missing permission during seed bootstrap: {}", code);
                continue;
            }
            RolePermission rolePermission = new RolePermission();
            RolePermissionId id = new RolePermissionId();
            id.setRoleId(role.getId());
            id.setPermissionId(permission.getId());
            rolePermission.setId(id);
            rolePermission.setRole(role);
            rolePermission.setPermission(permission);
            rolePermissionRepository.save(rolePermission);
        }
    }

    private void seedUsers() {
        if (userRepository.count() > 0) {
            log.info("Skipping sample user seed because users already exist");
            return;
        }

        for (UserSeed spec : userSeeds()) {
            ensureUser(spec);
        }
    }

    private UserAccount ensureUser(UserSeed spec) {
        Optional<UserAccount> existing = userRepository.findByUsername(spec.username())
                .or(() -> userRepository.findByEmail(spec.email()))
                .or(() -> userRepository.findByEmployeeCode(spec.employeeCode()));
        if (existing.isPresent()) {
            return existing.get();
        }

        Instant createdAt = Instant.now().minus(Duration.ofDays(spec.createdDaysAgo()));
        UserAccount user = new UserAccount();
        user.setUsername(spec.username());
        user.setEmail(spec.email());
        user.setEmployeeCode(spec.employeeCode());
        user.setFullName(spec.fullName());
        user.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
        user.setRoleName(spec.roleName());
        user.setDepartment(spec.department());
        user.setPosition(spec.position());
        user.setBusinessUnit(spec.businessUnit());
        user.setDateOfBirth(spec.dateOfBirth());
        user.setGender(spec.gender());
        user.setNationality(spec.nationality());
        user.setEmploymentType(spec.employmentType());
        user.setStartDate(spec.startDate());
        user.setManagerName(spec.managerName());
        user.setLanguage(spec.language());
        user.setPhone(spec.phone());
        user.setStatus(spec.status());
        user.setMustChangePassword(spec.mustChangePassword());
        user.setMfaEnabled(false);
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setPasswordChangedAt(spec.mustChangePassword() ? null : createdAt.plus(Duration.ofDays(1)));
        user.setLastLoginAt(spec.status() == UserStatus.Active ? createdAt.plus(Duration.ofDays(2)) : null);
        user.setSuspendReason(spec.suspendReason());
        user.setSuspendedUntil(spec.suspendedUntil());
        user.setTerminationReason(spec.terminationReason());
        user.setTerminationDate(spec.terminationDate());
        user.setCreatedAt(createdAt);
        user.setUpdatedAt(createdAt);
        return userRepository.save(user);
    }

    private void seedEducationAndCertifications() {
        ensureEducation("quality.lead1", "MSc", "Quality Management", "University of Technology", "2018", "3.78");
        ensureEducation("supervisor.ops1", "BSc", "Industrial Engineering", "National University", "2016", "3.45");
        ensureEducation("reviewer.lead1", "BSc", "Life Sciences", "City University", "2017", "3.62");

        ensureCertification("quality.lead1", "Lead Auditor ISO 9001", "CQI-IRCA", LocalDate.of(2024, 3, 12), LocalDate.of(2027, 3, 12));
        ensureCertification("supervisor.ops1", "Internal Quality Auditor", "TUV", LocalDate.of(2023, 8, 5), LocalDate.of(2026, 8, 5));
    }

    private void ensureEducation(String username, String degree, String fieldOfStudy, String institution, String graduationYear, String gpa) {
        UserAccount user = userRepository.findByUsername(username).orElse(null);
        if (user == null || !educationRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId()).isEmpty()) {
            return;
        }

        UserEducation education = new UserEducation();
        education.setUser(user);
        education.setDegree(degree);
        education.setFieldOfStudy(fieldOfStudy);
        education.setInstitution(institution);
        education.setGraduationYear(graduationYear);
        education.setGpa(gpa);
        education.setCreatedAt(Instant.now());
        education.setUpdatedAt(Instant.now());
        educationRepository.save(education);
    }

    private void ensureCertification(String username, String name, String issuingOrg, LocalDate issueDate, LocalDate expiryDate) {
        UserAccount user = userRepository.findByUsername(username).orElse(null);
        if (user == null || !certificationRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId()).isEmpty()) {
            return;
        }

        UserCertification certification = new UserCertification();
        certification.setUser(user);
        certification.setName(name);
        certification.setIssuingOrg(issuingOrg);
        certification.setIssueDate(issueDate);
        certification.setExpiryDate(expiryDate);
        certification.setFileName(slugify(name) + ".pdf");
        certification.setFileSize(0L);
        certification.setFileType("application/pdf");
        certification.setFileUrl(null);
        certification.setCreatedAt(Instant.now());
        certification.setUpdatedAt(Instant.now());
        certificationRepository.save(certification);
    }

    private void seedDocumentAdministration() {
        if (workflowSettingRepository.findAll().isEmpty()) {
            DocumentWorkflowSetting setting = new DocumentWorkflowSetting();
            setting.setReviewerNoApprove(false);
            setting.setRequireTwoReviewers(false);
            setting.setRequireOneApprover(true);
            workflowSettingRepository.save(setting);
        }

        ensurePoolMembers("DCO", List.of("admin", "dco.lead1", "dco.lead2", "doc.controller1", "workflow.dco1"));
        ensurePoolMembers("REVIEWER", List.of("reviewer.lead1", "reviewer.lead2", "quality.lead1", "supervisor.ops1"));
        ensurePoolMembers("APPROVER", List.of("approver.lead1", "approver.lead2", "quality.lead2", "supervisor.ops2"));
    }

    private void ensurePoolMembers(String poolType, List<String> usernames) {
        if (!poolMemberRepository.findAllByPoolTypeAndActiveTrueOrderByCreatedAtAsc(poolType).isEmpty()) {
            return;
        }

        for (String username : usernames) {
            UserAccount user = userRepository.findByUsername(username).orElse(null);
            if (user == null || poolMemberExists(poolType, user.getId())) {
                continue;
            }
            DocumentWorkflowPoolMember member = new DocumentWorkflowPoolMember();
            member.setPoolType(poolType);
            member.setUser(user);
            member.setActive(true);
            member.setCreatedAt(Instant.now());
            member.setUpdatedAt(Instant.now());
            poolMemberRepository.save(member);
        }
    }

    private boolean poolMemberExists(String poolType, UUID userId) {
        return poolMemberRepository.findAllByPoolType(poolType)
                .stream()
                .anyMatch(member -> poolType.equals(member.getPoolType()) && member.getUser() != null && userId.equals(member.getUser().getId()));
    }

    private List<SeedRoleSpec> roleSeeds() {
        return List.of(
                new SeedRoleSpec("ADMINISTRATOR", "Administrator", "System administrator access", true, true, permissionCodes(
                        "VIEW_USERS", "CREATE_USERS", "EDIT_USERS", "DELETE_USERS", "RESET_PASSWORDS",
                        "VIEW_DOCUMENTS", "CREATE_DOCUMENTS", "EDIT_DOCUMENTS", "REVIEW_DOCUMENTS", "APPROVE_DOCUMENTS",
                        "PUBLISH_DOCUMENTS", "VIEW_SETTINGS", "EDIT_SETTINGS", "MANAGE_ROLES", "VIEW_AUDIT_TRAIL",
                        "VIEW_REPORTS", "EXPORT_REPORTS",
                        "dashboard.module.view", "documents.module.view", "documents.admin.view",
                        "documents.admin.manage_workflow_roles", "documents.admin.manage_sod_constraints",
                        "documents.training.manage", "documents.training.complete",
                        "training.module.view", "training.material.manage",
                        "deviations.module.view", "change_control.module.view", "capa.module.view",
                        "complaints.module.view", "risk_management.module.view", "equipment.module.view",
                        "supplier.module.view", "product.module.view", "regulatory.module.view",
                        "report.module.view", "report.module.export", "audittrail.module.view",
                        "settings.user.view", "settings.user.create", "settings.user.edit", "settings.user.delete",
                        "settings.user.reset_password", "settings.user.force_logout",
                        "settings.role.view", "settings.role.manage", "settings.role.assign_permissions",
                        "settings.configuration.view", "settings.configuration.edit",
                        "my_tasks.module.view", "notifications.module.view", "preferences.module.view",
                        "preferences.module.edit"
                )),
                new SeedRoleSpec("DCO", "DCO", "Document control coordinator", true, true, permissionCodes(
                        "VIEW_USERS", "VIEW_DOCUMENTS", "CREATE_DOCUMENTS", "EDIT_DOCUMENTS", "SUBMIT_REVISION", "REVIEW_DOCUMENTS",
                        "APPROVE_DOCUMENTS", "PUBLISH_DOCUMENTS", "VIEW_AUDIT_TRAIL", "VIEW_REPORTS", "EXPORT_REPORTS",
                        "dashboard.module.view", "documents.module.view", "documents.admin.view",
                        "documents.admin.manage_workflow_roles", "documents.admin.manage_sod_constraints",
                        "documents.training.manage", "documents.training.complete",
                        "training.module.view", "report.module.view", "report.module.export", "audittrail.module.view",
                        "settings.configuration.view", "settings.configuration.edit",
                        "settings.user.view", "settings.user.create", "settings.user.edit", "settings.user.delete",
                        "settings.user.reset_password", "settings.user.force_logout",
                        "settings.role.view", "settings.role.manage", "settings.role.assign_permissions",
                        "my_tasks.module.view", "notifications.module.view", "preferences.module.view",
                        "preferences.module.edit"
                )),
                new SeedRoleSpec("QUALITY", "Quality", "Quality assurance role", true, true, permissionCodes(
                        "VIEW_USERS", "VIEW_DOCUMENTS", "CREATE_DOCUMENTS", "EDIT_DOCUMENTS", "REVIEW_DOCUMENTS",
                        "APPROVE_DOCUMENTS", "PUBLISH_DOCUMENTS", "VIEW_AUDIT_TRAIL", "VIEW_REPORTS", "EXPORT_REPORTS"
                )),
                new SeedRoleSpec("SUPERVISOR", "Supervisor", "Department supervisor access", true, true, permissionCodes(
                        "VIEW_DOCUMENTS", "CREATE_DOCUMENTS", "EDIT_DOCUMENTS", "REVIEW_DOCUMENTS",
                        "VIEW_AUDIT_TRAIL", "VIEW_REPORTS", "EXPORT_REPORTS"
                )),
                new SeedRoleSpec("VIEWER_OPERATOR", "Viewer/Operator", "Read-only operational access", true, true, permissionCodes(
                        "VIEW_DOCUMENTS",
                        "dashboard.module.view", "documents.module.view", "training.module.view",
                        "my_tasks.module.view", "notifications.module.view", "preferences.module.view",
                        "preferences.module.edit"
                )),
                new SeedRoleSpec("DOCUMENT_CONTROLLER", "Document Controller", "Custom document controller role", false, true, permissionCodes(
                        "VIEW_DOCUMENTS", "CREATE_DOCUMENTS", "EDIT_DOCUMENTS", "REVIEW_DOCUMENTS", "VIEW_REPORTS"
                )),
                new SeedRoleSpec("REVIEWER_LEAD", "Reviewer Lead", "Custom reviewer role", false, true, permissionCodes(
                        "VIEW_DOCUMENTS", "REVIEW_DOCUMENTS", "VIEW_REPORTS"
                )),
                new SeedRoleSpec("APPROVER_LEAD", "Approver Lead", "Custom approver role", false, true, permissionCodes(
                        "VIEW_DOCUMENTS", "APPROVE_DOCUMENTS", "VIEW_REPORTS"
                )),
                new SeedRoleSpec("DOCUMENT_TRAINEE", "Document Trainee", "Inactive sample role", false, false, permissionCodes(
                        "VIEW_DOCUMENTS"
                ))
        );
    }

    private List<UserSeed> userSeeds() {
        return List.of(
                new UserSeed("dco.lead1", "dco.lead1@eqms.com", "NTP.0002", "DCO Lead One", "DCO",
                        "Quality", "Quality Assurance", "QA Manager", UserStatus.Active, "Male", "Full-time",
                        "System Administrator", "English", "Vietnamese", "0901000002", LocalDate.of(1988, 2, 14),
                        LocalDate.of(2024, 1, 5), null, null, null, null, false, false, 24),
                new UserSeed("dco.lead2", "dco.lead2@eqms.com", "NTP.0003", "DCO Lead Two", "DCO",
                        "Management", "Executive Office", "Director", UserStatus.Active, "Female", "Full-time",
                        "System Administrator", "English", "Vietnamese", "0901000003", LocalDate.of(1985, 8, 22),
                        LocalDate.of(2023, 11, 20), null, null, null, null, false, false, 21),
                new UserSeed("workflow.dco1", "workflow.dco1@eqms.com", "NTP.9001", "Workflow DCO One", "DCO",
                        "Quality", "Document Control", "Document Control Officer", UserStatus.Active, "Female", "Full-time",
                        "System Administrator", "English", "Vietnamese", "0901009001", LocalDate.of(1991, 3, 11),
                        LocalDate.of(2024, 7, 1), null, null, null, null, false, false, 6),
                new UserSeed("sys.admin2", "sys.admin2@eqms.com", "NTP.0004", "System Admin Two", "Administrator",
                        "Corporate", "IT Department", "System Administrator", UserStatus.Active, "Male", "Full-time",
                        "System Administrator", "English", "Vietnamese", "0901000104", LocalDate.of(1990, 4, 18),
                        LocalDate.of(2024, 6, 3), null, null, null, null, false, false, 20),
                new UserSeed("quality.lead1", "quality.lead1@eqms.com", "NTP.0005", "Quality Lead One", "Quality",
                        "Quality", "Quality Assurance", "QA Manager", UserStatus.Active, "Female", "Full-time",
                        "DCO Lead One", "English", "Vietnamese", "0901000004", LocalDate.of(1989, 5, 16),
                        LocalDate.of(2023, 9, 12), null, null, null, null, false, false, 19),
                new UserSeed("quality.lead2", "quality.lead2@eqms.com", "NTP.0006", "Quality Lead Two", "Quality",
                        "Quality", "Quality Control", "QC Analyst", UserStatus.Suspended, "Male", "Full-time",
                        "DCO Lead One", "English", "Vietnamese", "0901000005", LocalDate.of(1990, 11, 9),
                        LocalDate.of(2023, 6, 18), "Performance review", LocalDate.now().plusDays(30), null, null, false, false, 18),
                new UserSeed("supervisor.ops1", "supervisor.ops1@eqms.com", "NTP.0007", "Operations Supervisor One", "Supervisor",
                        "Operations", "Production", "Production Coordinator", UserStatus.Active, "Male", "Full-time",
                        "Operations Director", "English", "Vietnamese", "0901000006", LocalDate.of(1987, 1, 27),
                        LocalDate.of(2022, 12, 1), null, null, null, null, false, false, 17),
                new UserSeed("supervisor.ops2", "supervisor.ops2@eqms.com", "NTP.0008", "Operations Supervisor Two", "Supervisor",
                        "Operations", "Warehouse", "Production Coordinator", UserStatus.Active, "Female", "Part-time",
                        "Operations Director", "English", "Vietnamese", "0901000007", LocalDate.of(1991, 7, 4),
                        LocalDate.of(2024, 2, 10), null, null, null, null, false, false, 16),
                new UserSeed("viewer.ops1", "viewer.ops1@eqms.com", "NTP.0009", "Operator One", "Viewer/Operator",
                        "Operations", "Production", "Production Coordinator", UserStatus.Active, "Male", "Full-time",
                        "Operations Supervisor", "English", "Vietnamese", "0901000008", LocalDate.of(1994, 3, 19),
                        LocalDate.of(2024, 5, 3), null, null, null, null, false, false, 15),
                new UserSeed("viewer.ops2", "viewer.ops2@eqms.com", "NTP.0010", "Operator Two", "Viewer/Operator",
                        "Operations", "Logistics", "Production Coordinator", UserStatus.Terminated, "Female", "Contract",
                        "Operations Supervisor", "English", "Vietnamese", "0901000009", LocalDate.of(1993, 9, 28),
                        LocalDate.of(2023, 8, 1), null, null, "Contract ended", LocalDate.of(2025, 12, 31), false, false, 14),
                new UserSeed("viewer.ops3", "viewer.ops3@eqms.com", "NTP.0011", "Operator Three", "Viewer/Operator",
                        "Operations", "Warehouse", "Production Coordinator", UserStatus.Pending, "Male", "Intern",
                        "Operations Supervisor", "English", "Vietnamese", "0901000010", LocalDate.of(2000, 12, 12),
                        LocalDate.of(2025, 1, 15), null, null, null, null, true, false, 13),
                new UserSeed("doc.controller1", "doc.controller1@eqms.com", "NTP.0012", "Document Controller One", "Document Controller",
                        "Quality", "Regulatory Affairs", "Regulatory Affairs Specialist", UserStatus.Active, "Female", "Full-time",
                        "Quality Lead One", "English", "Vietnamese", "0901000011", LocalDate.of(1988, 10, 30),
                        LocalDate.of(2024, 4, 8), null, null, null, null, false, false, 12),
                new UserSeed("reviewer.lead1", "reviewer.lead1@eqms.com", "NTP.0013", "Reviewer Lead One", "Reviewer Lead",
                        "Quality", "Quality Assurance", "QA Manager", UserStatus.Active, "Male", "Full-time",
                        "DCO Lead One", "English", "Vietnamese", "0901000012", LocalDate.of(1986, 6, 21),
                        LocalDate.of(2022, 10, 14), null, null, null, null, false, false, 11),
                new UserSeed("reviewer.lead2", "reviewer.lead2@eqms.com", "NTP.0014", "Reviewer Lead Two", "Reviewer Lead",
                        "Research", "Laboratory", "Research Scientist", UserStatus.Active, "Female", "Full-time",
                        "Quality Lead One", "English", "Vietnamese", "0901000013", LocalDate.of(1992, 4, 2),
                        LocalDate.of(2023, 3, 6), null, null, null, null, false, false, 10),
                new UserSeed("approver.lead1", "approver.lead1@eqms.com", "NTP.0015", "Approver Lead One", "Approver Lead",
                        "Management", "Executive Office", "Director", UserStatus.Active, "Male", "Full-time",
                        "System Administrator", "English", "Vietnamese", "0901000014", LocalDate.of(1984, 11, 3),
                        LocalDate.of(2021, 7, 19), null, null, null, null, false, false, 9),
                new UserSeed("approver.lead2", "approver.lead2@eqms.com", "NTP.0016", "Approver Lead Two", "Approver Lead",
                        "Quality", "Quality Control", "QC Analyst", UserStatus.Suspended, "Female", "Full-time",
                        "Quality Lead One", "English", "Vietnamese", "0901000015", LocalDate.of(1989, 9, 14),
                        LocalDate.of(2023, 12, 9), "Pending compliance review", LocalDate.now().plusDays(21), null, null, false, false, 8),
                new UserSeed("trainee.one", "trainee.one@eqms.com", "NTP.0017", "Document Trainee One", "Document Trainee",
                        "Corporate", "IT Department", "System Administrator", UserStatus.Inactive, "Male", "Intern",
                        "System Administrator", "English", "Vietnamese", "0901000016", LocalDate.of(2001, 2, 7),
                        LocalDate.of(2025, 2, 1), null, null, null, null, true, false, 7)
        );
    }

    private List<String> permissionCodes(String... codes) {
        return List.of(codes);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String slugify(String value) {
        if (value == null) {
            return "";
        }
        return value.trim()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    private record SeedRoleSpec(String code, String name, String description, boolean system, boolean active, List<String> permissions) {
    }

    private record UserSeed(
            String username,
            String email,
            String employeeCode,
            String fullName,
            String roleName,
            String businessUnit,
            String department,
            String position,
            UserStatus status,
            String gender,
            String employmentType,
            String managerName,
            String language,
            String nationality,
            String phone,
            LocalDate dateOfBirth,
            LocalDate startDate,
            String suspendReason,
            LocalDate suspendedUntil,
            String terminationReason,
            LocalDate terminationDate,
            boolean mustChangePassword,
            boolean mfaEnabled,
            int createdDaysAgo
    ) {
    }
}
