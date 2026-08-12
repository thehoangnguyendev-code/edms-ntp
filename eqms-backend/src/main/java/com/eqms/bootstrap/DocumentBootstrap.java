package com.eqms.bootstrap;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.DocumentType;
import com.eqms.entity.UserAccount;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Component
@Order(3)
public class DocumentBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DocumentBootstrap.class);

    private final DocumentRecordRepository documentRepository;
    private final DocumentStatusDefinitionRepository statusRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final DepartmentRepository departmentRepository;
    private final UserAccountRepository userAccountRepository;

    public DocumentBootstrap(
            DocumentRecordRepository documentRepository,
            DocumentStatusDefinitionRepository statusRepository,
            DocumentTypeRepository documentTypeRepository,
            BusinessUnitRepository businessUnitRepository,
            DepartmentRepository departmentRepository,
            UserAccountRepository userAccountRepository
    ) {
        this.documentRepository = documentRepository;
        this.statusRepository = statusRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.departmentRepository = departmentRepository;
        this.userAccountRepository = userAccountRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            UserAccount admin = userAccountRepository.findByUsername("admin").orElse(null);
            if (admin == null) {
                return;
            }

            List<UserAccount> authors = userAccountRepository.findAll(Sort.by(Sort.Direction.ASC, "fullName"));
            UserAccount authorA = authors.isEmpty() ? admin : authors.get(0);
            UserAccount authorB = authors.size() > 1 ? authors.get(1) : admin;
            UserAccount authorC = authors.size() > 2 ? authors.get(2) : admin;

            DocumentStatusDefinition draft = requireOrCreateStatus("DRAFT", "Draft", 1, false);
            DocumentStatusDefinition active = requireOrCreateStatus("ACTIVE", "Active", 2, false);
            DocumentStatusDefinition obsoleted = requireOrCreateStatus("OBSOLETED", "Obsoleted", 3, true);
            DocumentStatusDefinition closed = requireOrCreateStatus("CLOSED_CANCELLED", "Closed - Cancelled", 4, true);

            DocumentType sop = requireOrCreateDocumentType("SOP", "Standard Operating Procedure", 4, "Standard procedures for quality operations", true);
            DocumentType pol = requireOrCreateDocumentType("POL", "Policy", 3, "Company policies and guidelines", true);
            DocumentType form = requireOrCreateDocumentType("FORM", "Forms", 2, "Standard forms and templates", true);
            DocumentType qm = requireOrCreateDocumentType("QM", "Quality Manual", 1, "Quality management system manual", true);
            DocumentType spec = requireOrCreateDocumentType("SPEC", "Specification", 2, "Product and material specifications", false);

            BusinessUnit quality = requireOrCreateBusinessUnit("QUAL", "Quality", "Quality department");
            BusinessUnit operations = requireOrCreateBusinessUnit("OPER", "Operations", "Operations department");
            BusinessUnit management = requireOrCreateBusinessUnit("MGMT", "Management", "Management division");
            BusinessUnit research = requireOrCreateBusinessUnit("RESR", "Research", "Research division");

            Department qa = requireOrCreateDepartment("QA", "Quality Assurance", quality, "Quality Assurance", "Quality assurance team");
            Department qmDept = requireOrCreateDepartment("QM", "Quality Management", quality, "Quality Manager", "Quality management team");
            Department prod = requireOrCreateDepartment("PROD", "Production", operations, "Production Manager", "Production department");
            Department exec = requireOrCreateDepartment("EXEC", "Executive", management, "Executive Director", "Executive office");
            Department lab = requireOrCreateDepartment("LAB", "Laboratory", research, "Lab Supervisor", "Laboratory team");

            saveIfMissing(createDocument("SOP.0001", "Quality Control Testing Procedure", "3.0", draft, sop, quality, qa, authorA, admin,
                    "QA Admin", true, true, true, LocalDate.of(2025, 1, 15), LocalDate.of(2026, 1, 15)));
            saveIfMissing(createDocument("POL.0001", "Quality Management Policy", "2.1", active, pol, quality, qmDept, authorB, admin,
                    "QA Manager", false, false, false, LocalDate.of(2025, 2, 10), LocalDate.of(2026, 2, 10)));
            saveIfMissing(createDocument("FORM.0001", "Batch Production Record Form", "1.5", obsoleted, form, operations, prod, authorC, admin,
                    "Production Lead", false, true, false, LocalDate.of(2024, 8, 20), LocalDate.of(2025, 8, 20)));
            saveIfMissing(createDocument("QM.0001", "Company Quality Manual", "4.0", closed, qm, management, exec, authorA, admin,
                    "Executive Office", true, false, false, LocalDate.of(2024, 6, 1), LocalDate.of(2025, 6, 1)));
            saveIfMissing(createDocument("SPEC.0001", "Raw Material Specification", "2.0", active, spec, research, lab, authorB, admin,
                    "Laboratory Coordinator", false, true, true, LocalDate.of(2025, 5, 5), LocalDate.of(2026, 5, 5)));
            saveIfMissing(createDocument("SOP.0002", "Equipment Cleaning Procedure", "1.0", draft, sop, operations, prod, authorC, admin,
                    "Production Supervisor", false, true, false, LocalDate.of(2025, 9, 1), LocalDate.of(2026, 9, 1)));
            saveIfMissing(createDocument("POL.0002", "Document Control Policy", "1.2", active, pol, management, exec, authorA, admin,
                    "Document Control Team", true, false, true, LocalDate.of(2025, 3, 12), LocalDate.of(2026, 3, 12)));
            saveIfMissing(createDocument("SOP.0003", "Admin SOP for Internal Audit", "1.0", draft, sop, quality, qa, admin, admin,
                    "System Administrator", false, true, false, LocalDate.of(2025, 10, 1), LocalDate.of(2026, 10, 1)));
            saveIfMissing(createDocument("POL.0003", "Admin Data Entry Policy", "1.1", active, pol, quality, qa, admin, admin,
                    "System Administrator", false, false, true, LocalDate.of(2025, 11, 12), LocalDate.of(2026, 11, 12)));
            saveIfMissing(createDocument("FORM.0002", "Admin Corrective Action Form", "2.0", obsoleted, form, operations, prod, admin, admin,
                    "System Administrator", false, true, true, LocalDate.of(2024, 12, 5), LocalDate.of(2025, 12, 5)));
            saveIfMissing(createDocument("SPEC.0002", "Admin Lab Calibration Specification", "1.3", active, spec, research, lab, admin, admin,
                    "System Administrator", true, false, false, LocalDate.of(2025, 7, 20), LocalDate.of(2026, 7, 20)));
            saveIfMissing(createDocument("SOP.0004", "Admin Document Review SOP", "1.0", closed, sop, management, exec, admin, admin,
                    "System Administrator", false, false, true, LocalDate.of(2024, 11, 15), LocalDate.of(2025, 11, 15)));
        } catch (Exception ex) {
            log.warn("Document seed bootstrap skipped due to startup error: {}", ex.getMessage(), ex);
        }
    }

    private void saveIfMissing(DocumentRecord record) {
        boolean existsByNumber = documentRepository.existsByDocumentNumber(record.getDocumentNumber());
        boolean existsByTitle = documentRepository.findAll().stream()
                .anyMatch(existing -> existing.getDocumentName() != null && record.getDocumentName() != null && existing.getDocumentName().equalsIgnoreCase(record.getDocumentName()));
        if (!existsByNumber && !existsByTitle) {
            documentRepository.save(record);
        }
    }

    private DocumentRecord createDocument(
            String documentNumber,
            String documentName,
            String version,
            DocumentStatusDefinition status,
            DocumentType documentType,
            BusinessUnit businessUnit,
            Department department,
            UserAccount author,
            UserAccount openedBy,
            String openedByLabel,
            boolean template,
            boolean hasRelatedDocuments,
            boolean hasCorrelatedDocuments,
            LocalDate effectiveDate,
            LocalDate validUntil
    ) {
        DocumentRecord record = new DocumentRecord();
        record.setDocumentNumber(documentNumber);
        record.setDocumentName(documentName);
        record.setVersion(version);
        record.setStatus(status);
        record.setDocumentType(documentType);
        record.setBusinessUnit(businessUnit);
        record.setDepartment(department);
        record.setAuthor(author);
        record.setOwner(author);
        record.setOpenedBy(openedBy);
        record.setLastModifiedBy(openedBy);
        record.setDescription(documentName + " description");
        record.setKnowledgeBase(documentName + " KB");
        record.setTemplate(template);
        record.setHasRelatedDocuments(hasRelatedDocuments);
        record.setHasCorrelatedDocuments(hasCorrelatedDocuments);
        record.setEffectiveDate(effectiveDate);
        record.setValidUntil(validUntil);
        record.setCreatedAt(Instant.now().minusSeconds(86400L * 30));
        record.setUpdatedAt(Instant.now());
        return record;
    }

    private DocumentStatusDefinition requireOrCreateStatus(String code, String label, int sortOrder, boolean terminal) {
        return statusRepository.findById(code).orElseGet(() -> {
            DocumentStatusDefinition status = new DocumentStatusDefinition();
            status.setCode(code);
            status.setLabel(label);
            status.setSortOrder(sortOrder);
            status.setTerminal(terminal);
            status.setCreatedAt(Instant.now());
            status.setUpdatedAt(Instant.now());
            return statusRepository.save(status);
        });
    }

    private DocumentType requireOrCreateDocumentType(String shortCode, String name, int sequence, String description, boolean active) {
        return documentTypeRepository.findByShortCodeIgnoreCase(shortCode)
                .or(() -> documentTypeRepository.findByNameIgnoreCase(name))
                .map(existing -> {
                    boolean changed = false;
                    if (!shortCode.equalsIgnoreCase(existing.getShortCode())) {
                        existing.setShortCode(shortCode);
                        changed = true;
                    }
                    if (!name.equals(existing.getName())) {
                        existing.setName(name);
                        changed = true;
                    }
                    if (existing.getCurrentSequence() != sequence) {
                        existing.setCurrentSequence(sequence);
                        changed = true;
                    }
                    if (!java.util.Objects.equals(existing.getDescription(), description)) {
                        existing.setDescription(description);
                        changed = true;
                    }
                    if (existing.isActive() != active) {
                        existing.setActive(active);
                        changed = true;
                    }
                    if (changed) {
                        existing.setUpdatedAt(Instant.now());
                        return documentTypeRepository.save(existing);
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    DocumentType type = new DocumentType();
                    type.setShortCode(shortCode);
                    type.setName(name);
                    type.setCurrentSequence(sequence);
                    type.setDescription(description);
                    type.setActive(active);
                    type.setCreatedAt(Instant.now());
                    type.setUpdatedAt(Instant.now());
                    return documentTypeRepository.save(type);
                });
    }

    private BusinessUnit requireOrCreateBusinessUnit(String code, String name, String description) {
        return businessUnitRepository.findByCodeIgnoreCase(code).orElseGet(() -> {
            BusinessUnit unit = new BusinessUnit();
            unit.setCode(code);
            unit.setName(name);
            unit.setDescription(description);
            unit.setActive(true);
            unit.setCreatedAt(Instant.now());
            unit.setUpdatedAt(Instant.now());
            return businessUnitRepository.save(unit);
        });
    }

    private Department requireOrCreateDepartment(String code, String name, BusinessUnit businessUnit, String manager, String description) {
        return departmentRepository.findByCodeIgnoreCase(code).orElseGet(() -> {
            Department department = new Department();
            department.setBusinessUnit(businessUnit);
            department.setCode(code);
            department.setName(name);
            department.setManager(manager);
            department.setDescription(description);
            department.setActive(true);
            department.setCreatedAt(Instant.now());
            department.setUpdatedAt(Instant.now());
            return departmentRepository.save(department);
        });
    }
}
