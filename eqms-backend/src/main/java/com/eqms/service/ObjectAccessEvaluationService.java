package com.eqms.service;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ObjectAccessEvaluationService {

    private static final String ACTION_ALL = "ALL";
    private static final Set<String> GLOBAL_SCOPE_VALUES = Set.of("ALL", "*", "GLOBAL");

    private final ObjectAccessRuleRepository objectAccessRuleRepository;
    private final UserAccessProfileRepository userAccessProfileRepository;
    private final RoleDefinitionRepository roleDefinitionRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    // @Lazy breaks the circular dependency: DocumentAuthorizationService itself depends on this
    // service (ObjectAccessEvaluationService.canViewRevision), so it must be injected as a
    // lazy-init proxy here rather than eagerly, to reuse its single-source-of-truth DCO/Document
    // Admin check (canViewAllDocuments) instead of re-implementing that detection logic.
    private final DocumentAuthorizationService documentAuthorizationService;

    public ObjectAccessEvaluationService(
            ObjectAccessRuleRepository objectAccessRuleRepository,
            UserAccessProfileRepository userAccessProfileRepository,
            RoleDefinitionRepository roleDefinitionRepository,
            PermissionEvaluationService permissionEvaluationService,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            @Lazy DocumentAuthorizationService documentAuthorizationService
    ) {
        this.objectAccessRuleRepository = objectAccessRuleRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.roleDefinitionRepository = roleDefinitionRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.documentAuthorizationService = documentAuthorizationService;
    }

    public boolean canViewDocument(UserAccount user, DocumentRecord document) {
        return canAccessDocument(user, document, "VIEW");
    }

    public boolean canViewRevision(UserAccount user, DocumentRevisionRecord revision) {
        return canAccessRevision(user, revision, "VIEW");
    }

    public boolean canAccessDocument(UserAccount user, DocumentRecord document, String action) {
        if (user == null || user.getId() == null || document == null) {
            return false;
        }
        // DCO/Document Admin holds blanket cross-department access by design -- a Business
        // Unit/Department scope on an individual document/revision must not re-gate them.
        if (documentAuthorizationService.canViewAllDocuments(user)) {
            return true;
        }
        List<RoleDefinition> profiles = resolveActiveProfiles(user);
        if (profiles.isEmpty()) return false;

        RuleDecision ruleDecision = evaluateRules(profiles, action, document, null);
        if (ruleDecision == RuleDecision.DENY) {
            return false;
        }
        if (ruleDecision == RuleDecision.ALLOW) {
            return true;
        }
        if (hasRelevantAllowRules(profiles, action)) {
            return false;
        }

        ScopeDecision scopeDecision = evaluateProfileScope(profiles, document.getBusinessUnit(), document.getDepartment());
        return scopeDecision != ScopeDecision.DENY;
    }

    public boolean canAccessRevision(UserAccount user, DocumentRevisionRecord revision, String action) {
        if (user == null || user.getId() == null || revision == null) {
            return false;
        }
        // DCO/Document Admin holds blanket cross-department access by design -- a Business
        // Unit/Department scope on an individual document/revision must not re-gate them.
        if (documentAuthorizationService.canViewAllDocuments(user)) {
            return true;
        }
        // Explicit per-revision assignment (Author/Co-Author/Reviewer/Approver) is a stronger,
        // more specific authorization signal than a role's general Business Unit/Department
        // scope. That scope exists to gate broad, un-assigned access (e.g. browsing or acting on
        // documents outside your department) -- it must not override an explicit assignment to
        // this exact revision, which is how the Author/Co-Author/Reviewer/Approver ended up able
        // to be assigned to it in the first place. Business Unit/Department on the revision is
        // just a classification field, not meant to re-gate people already assigned to the work.
        if (isAssignedToRevision(user, revision)) {
            return true;
        }
        List<RoleDefinition> profiles = resolveActiveProfiles(user);
        if (profiles.isEmpty()) return false;

        RuleDecision ruleDecision = evaluateRules(profiles, action, revision.getDocument(), revision);
        if (ruleDecision == RuleDecision.DENY) {
            return false;
        }
        if (ruleDecision == RuleDecision.ALLOW) {
            return true;
        }
        if (hasRelevantAllowRules(profiles, action)) {
            return false;
        }

        ScopeDecision scopeDecision = evaluateProfileScope(profiles, revision.getBusinessUnit(), revision.getDepartment());
        return scopeDecision != ScopeDecision.DENY;
    }

    private boolean isAssignedToRevision(UserAccount user, DocumentRevisionRecord revision) {
        UUID userId = user.getId();
        UUID authorId = revision.getAuthor() == null ? null : revision.getAuthor().getId();
        if (Objects.equals(authorId, userId)) {
            return true;
        }
        for (String participantType : List.of("CO_AUTHOR", "REVIEWER", "APPROVER")) {
            boolean matches = revisionWorkflowParticipantRepository
                    .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(revision.getId(), participantType)
                    .stream()
                    .anyMatch(participant -> participant.getUser() != null && Objects.equals(participant.getUser().getId(), userId));
            if (matches) {
                return true;
            }
        }
        return false;
    }

    private List<RoleDefinition> resolveActiveProfiles(UserAccount user) {
        Set<UUID> seen = new LinkedHashSet<>();
        List<RoleDefinition> profiles = new ArrayList<>();
        for (UserAccessProfile assignment : userAccessProfileRepository.findByUserId(user.getId())) {
            RoleDefinition profile = assignment.getAccessProfile();
            if (profile == null && assignment.getAccessProfileId() != null) {
                profile = roleDefinitionRepository.findById(assignment.getAccessProfileId()).orElse(null);
            }
            if (profile == null || profile.getId() == null || !profile.isActive() || !seen.add(profile.getId())) {
                continue;
            }
            profiles.add(profile);
        }
        return profiles;
    }

    private RuleDecision evaluateRules(
            List<RoleDefinition> profiles,
            String action,
            DocumentRecord document,
            DocumentRevisionRecord revision
    ) {
        List<ObjectAccessRule> applicable = activeRulesForProfiles(profiles).stream()
                .filter(rule -> actionApplies(rule, action))
                .filter(rule -> resourceMatches(rule, document, revision))
                .sorted(Comparator.comparingInt(ObjectAccessRule::getPriority).reversed())
                .toList();
        if (applicable.isEmpty()) {
            return RuleDecision.NONE;
        }
        ObjectAccessRule topRule = applicable.get(0);
        return "DENY".equalsIgnoreCase(topRule.getEffect()) ? RuleDecision.DENY : RuleDecision.ALLOW;
    }

    private boolean hasRelevantAllowRules(List<RoleDefinition> profiles, String action) {
        return activeRulesForProfiles(profiles).stream()
                .filter(rule -> "ALLOW".equalsIgnoreCase(rule.getEffect()))
                .anyMatch(rule -> actionApplies(rule, action));
    }

    private List<ObjectAccessRule> activeRulesForProfiles(List<RoleDefinition> profiles) {
        Set<UUID> profileIds = profiles.stream()
                .map(RoleDefinition::getId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return objectAccessRuleRepository.findAllByActiveOrderByPriorityDescNameAsc(true)
                .stream()
                .filter(rule -> rule.getAccessProfiles().isEmpty()
                        || rule.getAccessProfiles().stream()
                        .anyMatch(profile -> profile.getId() != null && profileIds.contains(profile.getId())))
                .toList();
    }

    private boolean actionApplies(ObjectAccessRule rule, String action) {
        List<String> actions = rule.getActions();
        if (actions == null || actions.isEmpty()) {
            return true;
        }
        String normalizedAction = normalize(action);
        return actions.stream()
                .map(this::normalize)
                .anyMatch(candidate -> ACTION_ALL.equals(candidate)
                        || "*".equals(candidate)
                        || Objects.equals(candidate, normalizedAction));
    }

    private boolean resourceMatches(ObjectAccessRule rule, DocumentRecord document, DocumentRevisionRecord revision) {
        String type = normalize(rule.getResourceType());
        if (!StringUtils.hasText(type)) {
            return false;
        }
        return switch (type) {
            case "DOCUMENT_CATEGORY" -> matchesRuleValue(rule, revision == null ? null : revision.getSubType(),
                    document == null ? null : document.getSubType());
            case "DOCUMENT_TYPE" -> matchesDocumentType(rule, revision == null ? null : revision.getDocumentType(),
                    document == null ? null : document.getDocumentType());
            case "DOCUMENT_STATUS" -> matchesStatus(rule, document, revision);
            default -> false;
        };
    }

    private boolean matchesDocumentType(ObjectAccessRule rule, DocumentType revisionType, DocumentType documentType) {
        if (rule.getResourceId() == null && !StringUtils.hasText(rule.getResourceName())) {
            return true;
        }
        return matchesLookup(rule, revisionType == null ? null : revisionType.getId(),
                revisionType == null ? null : revisionType.getName(),
                revisionType == null ? null : revisionType.getShortCode())
                || matchesLookup(rule, documentType == null ? null : documentType.getId(),
                documentType == null ? null : documentType.getName(),
                documentType == null ? null : documentType.getShortCode());
    }

    private boolean matchesStatus(ObjectAccessRule rule, DocumentRecord document, DocumentRevisionRecord revision) {
        if (rule.getResourceId() == null && !StringUtils.hasText(rule.getResourceName())) {
            return true;
        }
        if (revision != null && revision.getStatus() != null) {
            String code = revision.getStatus().getCode();
            String label = revision.getStatus().getLabel();
            if (matchesText(rule.getResourceName(), code) || matchesText(rule.getResourceName(), label)) {
                return true;
            }
        }
        DocumentStatusDefinition status = document == null ? null : document.getStatus();
        if (status == null) {
            return false;
        }
        return matchesText(rule.getResourceName(), status.getCode()) || matchesText(rule.getResourceName(), status.getLabel());
    }

    private boolean matchesRuleValue(ObjectAccessRule rule, String... values) {
        if (rule.getResourceId() == null && !StringUtils.hasText(rule.getResourceName())) {
            return true;
        }
        for (String value : values) {
            if (matchesText(rule.getResourceName(), value)) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesLookup(ObjectAccessRule rule, UUID id, String name, String code) {
        if (rule.getResourceId() == null && !StringUtils.hasText(rule.getResourceName())) {
            return true;
        }
        if (rule.getResourceId() != null && Objects.equals(rule.getResourceId(), id)) {
            return true;
        }
        return matchesText(rule.getResourceName(), name) || matchesText(rule.getResourceName(), code)
                || (id != null && matchesText(rule.getResourceName(), id.toString()));
    }

    private ScopeDecision evaluateProfileScope(List<RoleDefinition> profiles, BusinessUnit businessUnit, Department department) {
        boolean hasSpecificScope = profiles.stream().anyMatch(this::hasSpecificScope);
        if (!hasSpecificScope) {
            return ScopeDecision.NONE;
        }
        boolean allowed = profiles.stream().anyMatch(profile ->
                scopeMatches(profile.getBusinessUnitScope(), businessUnit == null ? null : businessUnit.getId(),
                        businessUnit == null ? null : businessUnit.getName(),
                        businessUnit == null ? null : businessUnit.getCode())
                        && scopeMatches(profile.getDepartmentScope(), department == null ? null : department.getId(),
                        department == null ? null : department.getName(),
                        department == null ? null : department.getCode())
        );
        return allowed ? ScopeDecision.ALLOW : ScopeDecision.DENY;
    }

    private boolean hasSpecificScope(RoleDefinition profile) {
        return isSpecificScope(profile.getBusinessUnitScope()) || isSpecificScope(profile.getDepartmentScope());
    }

    private boolean isSpecificScope(String scope) {
        if (!StringUtils.hasText(scope)) {
            return false;
        }
        return parseScope(scope).stream().noneMatch(GLOBAL_SCOPE_VALUES::contains);
    }

    private boolean scopeMatches(String scope, UUID id, String name, String code) {
        if (!StringUtils.hasText(scope)) {
            return true;
        }
        Set<String> values = parseScope(scope);
        if (values.isEmpty() || values.stream().anyMatch(GLOBAL_SCOPE_VALUES::contains)) {
            return true;
        }
        return (id != null && values.contains(normalize(id.toString())))
                || (StringUtils.hasText(name) && values.contains(normalize(name)))
                || (StringUtils.hasText(code) && values.contains(normalize(code)));
    }

    private Set<String> parseScope(String scope) {
        if (!StringUtils.hasText(scope)) {
            return Set.of();
        }
        String cleaned = scope.replace("[", "")
                .replace("]", "")
                .replace("\"", "")
                .replace("'", "");
        Set<String> result = new LinkedHashSet<>();
        for (String part : cleaned.split("[,;|\\n\\r]+")) {
            String normalized = normalize(part);
            if (StringUtils.hasText(normalized)) {
                result.add(normalized);
            }
        }
        return result;
    }

    private boolean matchesText(String configured, String actual) {
        if (!StringUtils.hasText(configured)) {
            return false;
        }
        Set<String> values = parseScope(configured);
        if (values.isEmpty() || values.stream().anyMatch(GLOBAL_SCOPE_VALUES::contains)) {
            return true;
        }
        return StringUtils.hasText(actual) && values.contains(normalize(actual));
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private enum RuleDecision {
        NONE,
        ALLOW,
        DENY
    }

    private enum ScopeDecision {
        NONE,
        ALLOW,
        DENY
    }
}
