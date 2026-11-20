package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.*;
import com.eqms.service.export.*;
import java.io.IOException;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/** Exports the complete authorized query, never a browser-supplied collection of records. */
@RestController
@RequestMapping("/table-exports")
public class TableExcelExportController {
    private final TableExcelExportService exports;
    private final DocumentService documents;
    private final RevisionService revisions;
    private final ControlledCopyService copies;
    private final UserManagementService users;
    private final NotificationService notifications;
    private final AccessProfileService profiles;
    private final PermissionSetService sets;
    private final AuditTrailService audit;
    private final CurrentUserService current;
    private final PermissionEvaluationService permissions;
    private final com.eqms.repository.UserAccountRepository userRepository;
    private final BackupTableExportSource backupExports;

    public TableExcelExportController(TableExcelExportService exports, DocumentService documents,
            RevisionService revisions, ControlledCopyService copies, UserManagementService users,
            NotificationService notifications, AccessProfileService profiles, PermissionSetService sets,
            AuditTrailService audit, CurrentUserService current, PermissionEvaluationService permissions,
            com.eqms.repository.UserAccountRepository userRepository, BackupTableExportSource backupExports) {
        this.exports=exports; this.documents=documents; this.revisions=revisions; this.copies=copies;
        this.users=users; this.notifications=notifications; this.profiles=profiles; this.sets=sets;
        this.audit=audit; this.current=current; this.permissions=permissions;
        this.userRepository=userRepository;
        this.backupExports=backupExports;
    }

    @GetMapping("/{dataset:documents|revisions|controlled-copies|users|notifications|audit-trail|backups|backup-rehearsals|production-restores}")
    public ResponseEntity<StreamingResponseBody> export(@PathVariable String dataset,
            @RequestParam Map<String,String> q) throws IOException {
        return generate(dataset, q);
    }

    /** Retains the network gate of the administration registers, separate from normal document work. */
    @GetMapping("/{dataset:access-profiles|permission-sets}")
    public ResponseEntity<StreamingResponseBody> exportAdministration(@PathVariable String dataset,
            @RequestParam Map<String,String> q) throws IOException {
        return generate(dataset, q);
    }

    private ResponseEntity<StreamingResponseBody> generate(String dataset, Map<String,String> q) throws IOException {
        // Query and export run synchronously in one repeatable-read transaction. Only the completed file is streamed.
        String name = switch(dataset) {
            case "documents" -> "owned-by-me".equals(q.get("scope")) ? "Documents_Owned_By_Me" : "All_Document";
            case "revisions" -> Boolean.parseBoolean(q.get("ownedByMe")) ? "Revisions_Owned_By_Me"
                    : Boolean.parseBoolean(q.get("pending")) ? "Pending_Revisions" : "All_Revisions";
            case "controlled-copies" -> "Controlled_Copies";
            case "users" -> "Users";
            case "notifications" -> "Notifications";
            case "access-profiles" -> "Access_Profiles";
            case "permission-sets" -> "Permission_Sets";
            case "audit-trail" -> "Audit_Trail";
            case "backups" -> "Backups";
            case "backup-rehearsals" -> "Backup_Rehearsals";
            case "production-restores" -> "Production_Restores";
            default -> throw new IllegalArgumentException("Unknown table export");
        };
        return exports.generate(name, q, w -> write(dataset, q, w));
    }

    private void write(String dataset, Map<String,String> q, TableExcelWriter w) throws IOException {
        String search=q.get("search"), status=q.get("status");
        String sort=q.getOrDefault("sortBy", "created"), direction=q.getOrDefault("sortDirection", q.getOrDefault("sortDir","desc"));
        switch(dataset) {
            case "documents" -> documents.writeDocumentsExport(
                    q.getOrDefault("scope","all"), search, q.get("ids"), status, q.get("documentType"), q.get("businessUnit"),
                    q.get("department"), q.get("authorId"), q.get("author"), q.get("relatedDocument"), q.get("correlatedDocument"),
                    q.get("isTemplate"), q.get("createdFrom"), q.get("createdTo"), q.get("effectiveFrom"), q.get("effectiveTo"),
                    q.get("validFrom"), q.get("validTo"), q.get("reviewerId"), q.get("approverId"), q.get("requiresTraining"), sort, direction, w);
            case "revisions" -> revisions.writeRevisionsExport(search, q.get("ids"), status,
                    q.get("documentType"), q.get("businessUnit"), q.get("department"), q.get("authorId"), q.get("author"),
                    q.get("relatedDocument"), q.get("correlatedDocument"), q.get("isTemplate"), q.get("trainingNumber"),
                    q.get("createdFrom"), q.get("createdTo"), q.get("effectiveFrom"), q.get("effectiveTo"), q.get("validFrom"), q.get("validTo"),
                    Boolean.parseBoolean(q.get("ownedByMe")), Boolean.parseBoolean(q.get("pending")), sort, direction, w);
            case "audit-trail" -> audit.writeExport(search, q.get("module"), q.get("action"),
                    q.get("user"), q.get("severity"), q.get("documentNumber"), q.get("entityId"), status, q.get("ipAddress"),
                    q.containsKey("eSignatureOnly") ? Boolean.valueOf(q.get("eSignatureOnly")) : null, q.get("dateFrom"), q.get("dateTo"),
                    q.getOrDefault("sortBy","timestamp"), direction, q.get("reason"), q.get("signatureToken"), w);
            case "backups" -> backupExports.writeBackups(q, w);
            case "backup-rehearsals" -> backupExports.writeRehearsals(q, w);
            case "production-restores" -> backupExports.writeProductionRestores(q, w);
            case "controlled-copies" -> {
                w.headers("Batch Number","Document Number","Document Title","Revision","Quantity","Status","Distribution List",
                        "Valid Until","Expiry Date","Location","Location Code","Requested By","Requested At","Distributed By","Distributed At",
                        "Recall Date","Recall Reason","Last Updated","Usage Purpose");
                int page=1; boolean more;
                do {
                    var result=copies.listDistributionBatches(page++,500,search,status,q.get("documentId"),q.get("createdFrom"),q.get("createdTo"),
                            q.get("validFrom"),q.get("validTo"),q.get("expiryFrom"),q.get("expiryTo"),q.get("recallFrom"),q.get("recallTo"),q.get("usagePurpose"),sort,direction);
                    for(var r:result.data()) w.row(r.batchNumber(),r.documentNumber(),r.documentTitle(),r.revisionNumber(),r.quantity(),r.status(),r.distributionList(),
                            r.validUntil(),r.expiryDate(),r.location(),r.locationCode(),r.requestedBy(),r.requestedAt(),r.distributedBy(),r.distributedAt(),
                            r.recallDate(),r.recallReason(),r.lastUpdatedAt(),r.usagePurpose());
                    more=page<=result.pagination().totalPages();
                } while(more);
            }
            case "users" -> {
                if(!permissions.hasPermission(current.requireCurrentUser(),"settings.user.view")) throw new AccessDeniedException("Not allowed to view user accounts");
                w.headers("Employee ID","Full Name","Username","Email","Phone Number","Access Profiles","Position","Business Unit","Department","Account Status","Suspended Until","Termination Date","Last Login","Created Date","Last Updated");
                int page=1; boolean more;
                do {
                    var result=users.getUsers(page++,500,search,q.get("role"),status,q.get("online"),q.get("businessUnit"),q.get("department"),q.get("position"),
                            q.get("dateFrom"),q.get("dateTo"),q.get("suspendFrom"),q.get("suspendTo"),q.get("terminateFrom"),q.get("terminateTo"),
                            q.getOrDefault("sortBy","fullName"),direction,Boolean.parseBoolean(q.get("includeTerminated")),q.get("lastUpdatedFrom"),q.get("lastUpdatedTo"));
                    // Fetch timestamps only for IDs returned by the authorized register query.
                    Map<String,java.time.Instant> updated = new HashMap<>();
                    for(var account:userRepository.findAllById(result.data().stream().map(r->UUID.fromString(r.id())).toList())) {
                        updated.put(account.getId().toString(),account.getUpdatedAt());
                    }
                    for(var r:result.data()) w.row(r.employeeCode(),r.fullName(),r.username(),r.email(),r.phone(),String.join("; ",r.accessProfileNames()),r.position(),r.businessUnit(),r.department(),r.status(),r.suspendedUntil(),r.terminationDate(),r.lastLogin(),r.createdDate(),updated.get(r.id()));
                    more=page<=result.pagination().totalPages();
                } while(more);
            }
            case "notifications" -> {
                w.headers("Title","Description","Module","Priority","Status","Type","Sender","Related Number","Related Title","Created At","Read At");
                int page=1; boolean more;
                do {
                    var result=notifications.list(q.getOrDefault("scope","all"),search,q.get("type"),q.get("module"),q.get("priority"),status,q.get("sender"),
                            q.get("relatedNumber"),q.get("relatedTitle"),q.get("dateFrom"),q.get("dateTo"),q.getOrDefault("sortBy","createdAt"),direction,page++,500);
                    for(var r:result.data()) w.row(r.title(),r.description(),r.module(),r.priority(),r.status(),r.type(),r.sender()==null?null:r.sender().fullName(),
                            r.relatedItem()==null?null:r.relatedItem().documentNumber(),r.relatedItem()==null?null:r.relatedItem().title(),r.createdAt(),r.readAt());
                    more=page<=result.pagination().totalPages();
                } while(more);
            }
            case "access-profiles" -> {
                w.headers("Code","Name","Description","Type","Status","System","Permission Sets","Workflow Roles","Assigned Users","Document Visibility","Created At","Updated At");
                int page=0; boolean more;
                do {
                    var result=profiles.listProfiles(page++,500,search,q.get("type"),status,q.get("createdFrom"),q.get("createdTo"),q.get("updatedFrom"),q.get("updatedTo"),q.getOrDefault("sortBy","name"),direction);
                    for(var r:result.getContent()) w.row(r.code(),r.name(),r.description(),r.type(),r.active()?"Active":"Inactive",r.system(),
                            r.permissionSetCount(),String.join("; ",r.workflowRoles()),r.assignedUserCount(),r.documentControlVisibility(),r.createdAt(),r.updatedAt());
                    more=result.hasNext();
                } while(more);
            }
            case "permission-sets" -> {
                w.headers("Code","Name","Description","Status","System","Permission Count","Permission Codes","Modules","Category","Created At","Updated At");
                int page=1; boolean more;
                do {
                    var result=sets.listPaged(page++,500,search,status,q.get("type"),q.get("module"),q.get("category"),q.get("createdFrom"),q.get("createdTo"),
                            q.get("updatedFrom"),q.get("updatedTo"),q.getOrDefault("sortBy","name"),direction,false,null);
                    for(var r:result.data()) w.row(r.code(),r.name(),r.description(),r.active()?"Active":"Inactive",r.system(),r.permissionCount(),
                            String.join("; ",r.permissionCodes()),String.join("; ",r.modules()),r.category(),r.createdAt(),r.updatedAt());
                    more=page<=result.pagination().totalPages();
                } while(more);
            }
            default -> throw new IllegalArgumentException("Unknown table export");
        }
    }
}
