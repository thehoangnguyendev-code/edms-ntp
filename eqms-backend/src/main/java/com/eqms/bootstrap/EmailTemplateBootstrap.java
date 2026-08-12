package com.eqms.bootstrap;

import com.eqms.entity.EmailTemplate;
import com.eqms.entity.EmailTemplateVersion;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.repository.EmailTemplateVersionRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
@Order(4)
public class EmailTemplateBootstrap implements ApplicationRunner {

    private static final String SYSTEM_ACTOR = "System";
    private static final String ACTIVE = "Active";

    private final EmailTemplateRepository templateRepository;
    private final EmailTemplateVersionRepository versionRepository;

    public EmailTemplateBootstrap(
            EmailTemplateRepository templateRepository,
            EmailTemplateVersionRepository versionRepository
    ) {
        this.templateRepository = templateRepository;
        this.versionRepository = versionRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedSampleTemplates();
        backfillMissingVersions();
    }

    private void seedSampleTemplates() {
        for (TemplateSeed seed : templateSeeds()) {
            templateRepository.findByName(seed.name()).orElseGet(() -> createTemplate(seed));
        }
    }

    private EmailTemplate createTemplate(TemplateSeed seed) {
        EmailTemplate template = new EmailTemplate();
        template.setName(seed.name());
        template.setType(seed.type());
        template.setSubject(seed.subject());
        template.setContent(seed.content());
        template.setStatus(ACTIVE);
        template.setDescription(seed.description());
        template.setLogoUrl(null);
        template.setLogoFileName(null);
        template.setCopyright("© EQMS");
        template.setContactEmail("support@eqms.local");
        template.setVariablesList(seed.variables());
        template.setCreatedBy(SYSTEM_ACTOR);
        template.setUpdatedBy(SYSTEM_ACTOR);

        EmailTemplate saved = templateRepository.save(template);
        createVersionSnapshot(saved, seed.changeSummary(), true);
        return saved;
    }

    private void backfillMissingVersions() {
        for (EmailTemplate template : templateRepository.findAll()) {
            if (versionRepository.findByTemplateIdOrderByVersionNumberDesc(template.getId()).isEmpty()) {
                createVersionSnapshot(template, "Seeded initial version", ACTIVE.equalsIgnoreCase(template.getStatus()));
            }
        }
    }

    private void createVersionSnapshot(EmailTemplate template, String changeSummary, boolean published) {
        int nextVersion = versionRepository.findTopByTemplateIdOrderByVersionNumberDesc(template.getId())
                .map(EmailTemplateVersion::getVersionNumber)
                .orElse(0) + 1;

        EmailTemplateVersion version = new EmailTemplateVersion();
        version.setTemplate(template);
        version.setVersionNumber(nextVersion);
        version.setName(template.getName());
        version.setType(template.getType());
        version.setSubject(template.getSubject());
        version.setContent(template.getContent());
        version.setStatus(template.getStatus());
        version.setDescription(template.getDescription());
        version.setLogoUrl(template.getLogoUrl());
        version.setLogoFileName(template.getLogoFileName());
        version.setCopyright(template.getCopyright());
        version.setContactEmail(template.getContactEmail());
        version.setVariables(template.getVariables());
        version.setChangeSummary(changeSummary);
        version.setCreatedBy(template.getCreatedBy() != null ? template.getCreatedBy() : SYSTEM_ACTOR);
        if (published) {
            version.setPublishedAt(Instant.now());
            version.setPublishedBy(template.getUpdatedBy() != null ? template.getUpdatedBy() : SYSTEM_ACTOR);
        }
        versionRepository.save(version);
    }

    private List<TemplateSeed> templateSeeds() {
        return List.of(
                new TemplateSeed(
                        "Document Review Notification",
                        "document-review",
                        "{{documentNumber}} - Review Required: {{documentTitle}}",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>A document revision is waiting for your review.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}} ({{documentNumber}})</p>
                                    <p><strong>Revision:</strong> {{revisionNumber}}</p>
                                    <p><strong>Status:</strong> {{revisionStatus}}</p>
                                    <p><strong>Author:</strong> {{documentAuthorName}}</p>
                                    <p><strong>Department:</strong> {{documentDepartment}}</p>
                                    <p><strong>Due Date:</strong> {{documentReviewDate}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Please open the document review task and complete your action.</p>
                                  <p><strong>Action:</strong> {{workflowAction}}</p>
                                  <p><strong>Reason:</strong> {{workflowReason}}</p>
                                  <p>Open document: <a href="{{documentUrl}}">{{documentUrl}}</a></p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Document review notification for reviewers",
                        vars(
                                "recipientName", "documentTitle", "documentNumber", "revisionNumber", "revisionStatus",
                                "documentAuthorName", "documentDepartment", "documentReviewDate", "workflowAction",
                                "workflowReason", "workflowComment", "documentUrl", "systemName"
                        ),
                        "Seeded sample template for document review notifications"
                ),
                new TemplateSeed(
                        "Document Approval Notification",
                        "document-approval",
                        "{{documentNumber}} - Approval Required: {{documentTitle}}",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>A reviewed document is ready for your approval.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}} ({{documentNumber}})</p>
                                    <p><strong>Revision:</strong> {{revisionNumber}}</p>
                                    <p><strong>Current Stage:</strong> {{workflowStage}}</p>
                                    <p><strong>Effective Date:</strong> {{revisionEffectiveDate}}</p>
                                    <p><strong>Valid Until:</strong> {{revisionValidUntil}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Please review the PDF rendition and complete your approval action.</p>
                                  <p><strong>Action:</strong> {{workflowAction}}</p>
                                  <p><strong>Reason:</strong> {{workflowReason}}</p>
                                  <p>Open document: <a href="{{documentUrl}}">{{documentUrl}}</a></p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Document approval notification for approvers",
                        vars(
                                "recipientName", "documentTitle", "documentNumber", "revisionNumber", "workflowStage",
                                "revisionEffectiveDate", "revisionValidUntil", "workflowAction", "workflowReason", "workflowComment",
                                "documentUrl", "systemName"
                        ),
                        "Seeded sample template for document approval notifications"
                ),
                new TemplateSeed(
                        "Document Ready for Publishing Notification",
                        "document-ready-for-publishing",
                        "{{documentNumber}} - Ready for Publishing: {{documentTitle}}",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>The document revision has completed its workflow and is ready for DCO publishing.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}} ({{documentNumber}})</p>
                                    <p><strong>Revision:</strong> {{revisionNumber}}</p>
                                    <p><strong>Status:</strong> {{revisionStatus}}</p>
                                    <p><strong>Effective Date:</strong> {{revisionEffectiveDate}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Please verify the publishing package and publish when ready. This revision is not Effective yet.</p>
                                  <p>Open revision: <a href="{{documentUrl}}">{{documentUrl}}</a></p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Notification for DCO when a revision is ready for publishing, but not yet effective",
                        vars(
                                "recipientName", "documentTitle", "documentNumber", "revisionNumber", "revisionStatus",
                                "revisionEffectiveDate", "documentUrl", "systemName"
                        ),
                        "Seeded template for ready-for-publishing notifications"
                ),
                new TemplateSeed(
                        "Document Publish Notification",
                        "document-publish",
                        "{{documentNumber}} - Published: {{documentTitle}}",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>The document revision below has been published and is now effective.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}} ({{documentNumber}})</p>
                                    <p><strong>Revision:</strong> {{revisionNumber}}</p>
                                    <p><strong>Published At:</strong> {{revisionPublishedAt}}</p>
                                    <p><strong>Published By:</strong> {{revisionPublishedBy}}</p>
                                    <p><strong>Effective Date:</strong> {{revisionEffectiveDate}}</p>
                                    <p><strong>Valid Until:</strong> {{revisionValidUntil}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Open the latest effective version here: <a href="{{documentUrl}}">{{documentUrl}}</a></p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Document publish notification for effective revisions",
                        vars(
                                "recipientName", "documentTitle", "documentNumber", "revisionNumber",
                                "revisionPublishedAt", "revisionPublishedBy", "revisionEffectiveDate",
                                "revisionValidUntil", "documentUrl", "systemName"
                        ),
                        "Seeded sample template for document publish notifications"
                ),
                new TemplateSeed(
                        "Document Office Online Edit Notification",
                        "document-edit-online-notification",
                        "{{documentNumber}} - Edit Online Ready: {{documentTitle}}",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>You have been assigned to edit the document revision below in Office Online.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}} ({{documentNumber}})</p>
                                    <p><strong>Revision:</strong> {{revisionName}} - {{revisionNumber}}</p>
                                    <p><strong>Status:</strong> {{revisionStatus}}</p>
                                    <p><strong>Author:</strong> {{documentAuthorName}}</p>
                                    <p><strong>Action:</strong> {{workflowAction}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Open the revision workspace: <a href="{{revisionUrl}}">{{revisionUrl}}</a></p>
                                  <p>Edit file online: <a href="{{officeEditUrl}}">{{officeEditUrl}}</a></p>
                                  <p><strong>Note:</strong> {{workflowComment}}</p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Notification for authors and co-authors when a revision is ready for Office Online editing",
                        vars(
                                "recipientName", "documentTitle", "documentNumber", "revisionName", "revisionNumber",
                                "revisionStatus", "documentAuthorName", "workflowAction", "workflowComment",
                                "revisionUrl", "officeEditUrl", "systemName"
                        ),
                        "Seeded sample template for Office Online edit assignment notifications"
                ),
                new TemplateSeed(
                        "Training Notification",
                        "training-notification",
                        "Training Required: {{documentTitle}} (Revision {{revisionNumber}})",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>Training has been assigned for a document revision that requires completion.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}} ({{documentNumber}})</p>
                                    <p><strong>Revision:</strong> {{revisionNumber}}</p>
                                    <p><strong>Planned Date:</strong> {{trainingPlannedDate}}</p>
                                    <p><strong>Training Period End:</strong> {{trainingPeriodEndDate}}</p>
                                    <p><strong>Completion Date:</strong> {{trainingCompletionDate}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Please complete the assigned training before the deadline.</p>
                                  <p><strong>Action:</strong> {{workflowAction}}</p>
                                  <p><strong>Comment:</strong> {{workflowComment}}</p>
                                  <p>Open document: <a href="{{documentUrl}}">{{documentUrl}}</a></p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Training notification for document revision training",
                        vars(
                                "recipientName", "documentTitle", "documentNumber", "revisionNumber",
                                "trainingPlannedDate", "trainingPeriodEndDate", "trainingCompletionDate",
                                "workflowAction", "workflowComment", "documentUrl", "systemName"
                        ),
                        "Seeded sample template for training notifications"
                ),
                new TemplateSeed(
                        "Controlled Copy Notification",
                        "controlled-copy-notification",
                        "Controlled Copy {{controlledCopyNumber}} - {{workflowAction}}",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>A controlled copy workflow action has been performed.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Controlled Copy:</strong> {{controlledCopyNumber}}</p>
                                    <p><strong>Copy Number:</strong> {{copyNumber}} / {{totalCopies}}</p>
                                    <p><strong>Status:</strong> {{controlledCopyStatus}}</p>
                                    <p><strong>Distribution Scope:</strong> {{distributionScope}}</p>
                                    <p><strong>Distribution Location:</strong> {{distributionLocation}}</p>
                                  </div>
                                  <p style="margin-top: 16px;">Open the controlled copy record: <a href="{{controlledCopyUrl}}">{{controlledCopyUrl}}</a></p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Controlled copy workflow notification",
                        vars(
                                "recipientName", "controlledCopyNumber", "copyNumber", "totalCopies",
                                "controlledCopyStatus", "distributionScope", "distributionLocation",
                                "distributionComment", "recipientSignature", "recipientDate", "recallReason",
                                "destroyReason", "destroyedAt", "witnessName", "controlledCopyUrl",
                                "workflowAction", "workflowComment", "systemName"
                        ),
                        "Seeded sample template for controlled copy notifications"
                ),
                new TemplateSeed(
                        "Controlled Copy Distribution Notification",
                        "controlled-copy-distribution-notification",
                        "{{controlledCopyNumber}} - Controlled Copy Available",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>A new controlled copy is available.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}}</p>
                                    <p><strong>Revision Number:</strong> {{revisionNumber}}</p>
                                    <p><strong>Controlled Copy Number:</strong> {{controlledCopyNumber}}</p>
                                    <p><strong>Link preview:</strong> <a href="{{controlledCopyPreviewUrl}}">{{controlledCopyPreviewUrl}}</a></p>
                                  </div>
                                  <p style="margin-top: 16px;">Please review the document in the system.</p>
                                  <p style="margin-top: 8px; color: #6b7280; font-size: 12px;">
                                    This email contains a secure link only. No file is attached. Access is authenticated and audited in the system.
                                  </p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Controlled copy distribution notification",
                        vars(
                                "recipientName", "controlledCopyNumber", "documentTitle", "revisionNumber",
                                "controlledCopyPreviewUrl", "systemName"
                        ),
                        "Seeded sample template for controlled copy distribution notifications"
                ),
                new TemplateSeed(
                        "Controlled Copy Cancellation Notification",
                        "controlled-copy-cancellation-notification",
                        "{{controlledCopyNumber}} - Controlled Copy Cancelled",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>A controlled copy has been cancelled and is no longer available for use.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Scope:</strong> {{workflowScope}}</p>
                                    <p><strong>Batch Number:</strong> {{batchNumber}}</p>
                                    <p><strong>Controlled Copy:</strong> {{controlledCopyNumber}}</p>
                                    <p><strong>Document:</strong> {{documentTitle}}</p>
                                    <p><strong>Revision Number:</strong> {{revisionNumber}}</p>
                                    <p><strong>Status:</strong> {{controlledCopyStatus}}</p>
                                    <p><strong>Reason:</strong> {{workflowComment}}</p>
                                    <p><strong>Detail:</strong> <a href="{{controlledCopyUrl}}">{{controlledCopyUrl}}</a></p>
                                  </div>
                                  <p style="margin-top: 16px;">Please note that this controlled copy should no longer be used.</p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Controlled copy cancellation notification",
                        vars(
                                "recipientName", "workflowScope", "batchNumber", "controlledCopyNumber", "documentTitle",
                                "revisionNumber", "controlledCopyStatus", "workflowComment", "controlledCopyUrl",
                                "systemName"
                        ),
                        "Seeded sample template for controlled copy cancellation notifications"
                ),
                new TemplateSeed(
                        "Controlled Copy Recall Notification",
                        "controlled-copy-recall-notification",
                        "{{controlledCopyNumber}} - Controlled Copy Recalled",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>A controlled copy has been recalled and is no longer valid for use.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Scope:</strong> {{workflowScope}}</p>
                                    <p><strong>Batch Number:</strong> {{batchNumber}}</p>
                                    <p><strong>Controlled Copy:</strong> {{controlledCopyNumber}}</p>
                                    <p><strong>Document:</strong> {{documentTitle}}</p>
                                    <p><strong>Revision Number:</strong> {{revisionNumber}}</p>
                                    <p><strong>Status:</strong> {{controlledCopyStatus}}</p>
                                    <p><strong>Reason:</strong> {{workflowComment}}</p>
                                    <p><strong>Detail:</strong> <a href="{{controlledCopyUrl}}">{{controlledCopyUrl}}</a></p>
                                  </div>
                                  <p style="margin-top: 16px;">Please stop using this controlled copy immediately.</p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Controlled copy recall notification",
                        vars(
                                "recipientName", "workflowScope", "batchNumber", "controlledCopyNumber", "documentTitle",
                                "revisionNumber", "controlledCopyStatus", "workflowComment", "controlledCopyUrl",
                                "systemName"
                        ),
                        "Seeded sample template for controlled copy recall notifications"
                ),
                new TemplateSeed(
                        "Controlled Copy Expiry Notification",
                        "controlled-copy-expiry-notification",
                        "{{controlledCopyNumber}} - Controlled Copy Expiry Reminder",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>The controlled copy below will expire soon.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Document:</strong> {{documentTitle}}</p>
                                    <p><strong>Revision Number:</strong> {{revisionNumber}}</p>
                                    <p><strong>Controlled Copy Number:</strong> {{controlledCopyNumber}}</p>
                                    <p><strong>Expiry Date:</strong> {{expiryDate}}</p>
                                    <p><strong>Execution Date:</strong> {{executionDate}}</p>
                                    <p><strong>Link preview:</strong> <a href="{{controlledCopyPreviewUrl}}">{{controlledCopyPreviewUrl}}</a></p>
                                  </div>
                                  <p style="margin-top: 16px;">Please take action before the expiry date.</p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Controlled copy expiry reminder notification",
                        vars(
                                "recipientName", "documentTitle", "revisionNumber", "controlledCopyNumber",
                                "expiryDate", "executionDate", "controlledCopyPreviewUrl", "systemName"
                        ),
                        "Seeded sample template for controlled copy expiry notifications"
                ),
                new TemplateSeed(
                        "Preference Change Notification",
                        "preference-notification",
                        "{{preferenceSection}} updated successfully",
                        """
                                <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                                  <p>Hello {{recipientName}},</p>
                                  <p>Your preference or security setting has been updated successfully.</p>
                                  <div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    <p><strong>Section:</strong> {{preferenceSection}}</p>
                                    <p><strong>Preference:</strong> {{preferenceName}}</p>
                                    <p><strong>Change Summary:</strong> {{changeSummary}}</p>
                                    <p><strong>Updated At:</strong> {{updatedAt}}</p>
                                    <p><strong>Performed By:</strong> {{actorName}} ({{actorEmail}})</p>
                                  </div>
                                  <p style="margin-top: 16px;">If you did not request this change, please contact the system administrator.</p>
                                  <p>Best regards,<br/>{{systemName}}</p>
                                </div>
                                """,
                        "Preference update notification for user security changes",
                        vars(
                                "recipientName", "preferenceSection", "preferenceName", "changeSummary",
                                "updatedAt", "actorName", "actorEmail", "systemName"
                        ),
                        "Seeded sample template for preference change notifications"
                )
        );
    }

    private List<String> vars(String... values) {
        return List.of(values);
    }

    private record TemplateSeed(
            String name,
            String type,
            String subject,
            String content,
            String description,
            List<String> variables,
            String changeSummary
    ) {
    }
}
