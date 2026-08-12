package com.eqms;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.ObjectAccessEvaluationService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObjectAccessEvaluationServiceTest {

    @Mock private ObjectAccessRuleRepository objectAccessRuleRepository;
    @Mock private UserAccessProfileRepository userAccessProfileRepository;
    @Mock private RoleDefinitionRepository roleDefinitionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentAuthorizationService documentAuthorizationService;

    private ObjectAccessEvaluationService service;
    private UserAccount user;
    private RoleDefinition profile;

    @BeforeEach
    void setUp() {
        service = new ObjectAccessEvaluationService(
                objectAccessRuleRepository,
                userAccessProfileRepository,
                roleDefinitionRepository,
                permissionEvaluationService,
                revisionWorkflowParticipantRepository,
                documentAuthorizationService
        );
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setUsername("qa.user");

        profile = new RoleDefinition();
        profile.setId(UUID.randomUUID());
        profile.setCode("QA_REVIEWER");
        profile.setName("QA Reviewer");
        profile.setActive(true);
    }

    @Test
    void canViewDocument_withoutAccessProfile_isDeniedWhenLegacyFallbackIsDisabled() {
        DocumentRecord document = document("SOP", "Standard Operating Procedure", "QA", "QC");
        when(userAccessProfileRepository.findByUserId(user.getId())).thenReturn(List.of());

        assertFalse(service.canViewDocument(user, document));
    }

    @Test
    void canViewDocument_allowRuleForDocumentType_allowsMatchingDocumentAndDeniesNonMatchingDocument() {
        ObjectAccessRule allowSop = rule(profile, "DOCUMENT_TYPE", "SOP", "ALLOW", 100, "VIEW");
        when(userAccessProfileRepository.findByUserId(user.getId())).thenReturn(List.of(assignment(profile)));
        when(roleDefinitionRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(objectAccessRuleRepository.findAllByActiveOrderByPriorityDescNameAsc(true)).thenReturn(List.of(allowSop));

        assertTrue(service.canViewDocument(user, document("SOP", "Standard Operating Procedure", "QA", "QC")));
        assertFalse(service.canViewDocument(user, document("POL", "Policy", "QA", "QC")));
    }

    @Test
    void canViewDocument_denyRuleForDocumentType_overridesAllowRule() {
        ObjectAccessRule allowAllTypes = rule(profile, "DOCUMENT_TYPE", null, "ALLOW", 10, "VIEW");
        ObjectAccessRule denySop = rule(profile, "DOCUMENT_TYPE", "SOP", "DENY", 100, "VIEW");
        when(userAccessProfileRepository.findByUserId(user.getId())).thenReturn(List.of(assignment(profile)));
        when(roleDefinitionRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(objectAccessRuleRepository.findAllByActiveOrderByPriorityDescNameAsc(true)).thenReturn(List.of(denySop, allowAllTypes));

        assertFalse(service.canViewDocument(user, document("SOP", "Standard Operating Procedure", "QA", "QC")));
        assertTrue(service.canViewDocument(user, document("POL", "Policy", "QA", "QC")));
    }

    @Test
    void canViewRevision_profileBusinessUnitAndDepartmentScope_areEnforced() {
        profile.setBusinessUnitScope("QA");
        profile.setDepartmentScope("QC");
        when(userAccessProfileRepository.findByUserId(user.getId())).thenReturn(List.of(assignmentWithoutLoadedProfile(profile)));
        when(roleDefinitionRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(objectAccessRuleRepository.findAllByActiveOrderByPriorityDescNameAsc(true)).thenReturn(List.of());

        assertTrue(service.canViewRevision(user, revision("SOP", "QA", "QC")));
        assertFalse(service.canViewRevision(user, revision("SOP", "QA", "RA")));
        assertFalse(service.canViewRevision(user, revision("SOP", "PROD", "QC")));
    }

    @Test
    void canViewDocument_legacyRoleNameCannotResolveObjectAccessProfile() {
        user.setRoleName("QA_REVIEWER");
        when(userAccessProfileRepository.findByUserId(user.getId())).thenReturn(List.of());

        assertFalse(service.canViewDocument(user, document("POL", "Policy", "QA", "QC")));
        assertFalse(service.canViewDocument(user, document("SOP", "Standard Operating Procedure", "QA", "QC")));
    }

    private UserAccessProfile assignment(RoleDefinition role) {
        UserAccessProfile assignment = new UserAccessProfile();
        assignment.setUserId(user.getId());
        assignment.setAccessProfileId(role.getId());
        return assignment;
    }

    private UserAccessProfile assignmentWithoutLoadedProfile(RoleDefinition role) {
        UserAccessProfile assignment = new UserAccessProfile();
        assignment.setUserId(user.getId());
        assignment.setAccessProfileId(role.getId());
        return assignment;
    }

    private ObjectAccessRule rule(RoleDefinition role, String resourceType, String resourceName, String effect, int priority, String... actions) {
        ObjectAccessRule rule = new ObjectAccessRule();
        rule.setName(effect + " " + resourceType + " " + resourceName);
        rule.setAccessProfiles(role == null ? java.util.Set.of() : java.util.Set.of(role));
        rule.setResourceType(resourceType);
        rule.setResourceName(resourceName);
        rule.setEffect(effect);
        rule.setPriority(priority);
        rule.setActive(true);
        rule.setActions(List.of(actions));
        return rule;
    }

    private DocumentRevisionRecord revision(String documentTypeCode, String businessUnitCode, String departmentCode) {
        DocumentRecord document = document(documentTypeCode, documentTypeCode, businessUnitCode, departmentCode);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setDocument(document);
        revision.setDocumentType(document.getDocumentType());
        revision.setBusinessUnit(document.getBusinessUnit());
        revision.setDepartment(document.getDepartment());
        return revision;
    }

    private DocumentRecord document(String documentTypeCode, String documentTypeName, String businessUnitCode, String departmentCode) {
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDocumentNumber(documentTypeCode + ".0001");
        document.setDocumentName(documentTypeName);
        document.setDocumentType(documentType(documentTypeCode, documentTypeName));
        BusinessUnit businessUnit = businessUnit(businessUnitCode);
        document.setBusinessUnit(businessUnit);
        document.setDepartment(department(departmentCode, businessUnit));
        return document;
    }

    private DocumentType documentType(String code, String name) {
        DocumentType documentType = new DocumentType();
        documentType.setId(UUID.randomUUID());
        documentType.setShortCode(code);
        documentType.setName(name);
        documentType.setActive(true);
        return documentType;
    }

    private BusinessUnit businessUnit(String code) {
        BusinessUnit businessUnit = new BusinessUnit();
        businessUnit.setId(UUID.randomUUID());
        businessUnit.setCode(code);
        businessUnit.setName(code + " Unit");
        businessUnit.setActive(true);
        return businessUnit;
    }

    private Department department(String code, BusinessUnit businessUnit) {
        Department department = new Department();
        department.setId(UUID.randomUUID());
        department.setCode(code);
        department.setName(code + " Department");
        department.setBusinessUnit(businessUnit);
        department.setActive(true);
        return department;
    }
}
