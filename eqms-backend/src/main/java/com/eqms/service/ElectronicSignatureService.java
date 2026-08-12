package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.esignature.ElectronicSignatureMeaningRequest;
import com.eqms.dto.esignature.ElectronicSignatureMeaningResponse;
import com.eqms.dto.esignature.ElectronicSignatureRecordResponse;
import com.eqms.dto.esignature.ElectronicSignatureSettingsRequest;
import com.eqms.dto.esignature.ElectronicSignatureSettingsResponse;
import com.eqms.dto.document.DocumentParticipantResponse;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ElectronicSignatureMeaning;
import com.eqms.entity.ElectronicSignatureSetting;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ElectronicSignatureMeaningRepository;
import com.eqms.repository.ElectronicSignatureRepository;
import com.eqms.repository.ElectronicSignatureSettingRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.Comparator;

@Service
public class ElectronicSignatureService {

    private static final DateTimeFormatter SIGNATURE_ID_YEAR = DateTimeFormatter.ofPattern("yyyy").withZone(ZoneId.systemDefault());
    private final ElectronicSignatureRepository signatureRepository;
    private final ElectronicSignatureSettingRepository settingRepository;
    private final ElectronicSignatureMeaningRepository meaningRepository;
    private final RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    private final CurrentUserService currentUserService;
    private final TokenService tokenService;
    private final AuditTrailService auditTrailService;
    private final ElectronicSignatureRendererService signatureRendererService;

    public ElectronicSignatureService(
            ElectronicSignatureRepository signatureRepository,
            ElectronicSignatureSettingRepository settingRepository,
            ElectronicSignatureMeaningRepository meaningRepository,
            RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository,
            CurrentUserService currentUserService,
            TokenService tokenService,
            AuditTrailService auditTrailService,
            ElectronicSignatureRendererService signatureRendererService
    ) {
        this.signatureRepository = signatureRepository;
        this.settingRepository = settingRepository;
        this.meaningRepository = meaningRepository;
        this.revisionWorkflowParticipantRepository = revisionWorkflowParticipantRepository;
        this.currentUserService = currentUserService;
        this.tokenService = tokenService;
        this.auditTrailService = auditTrailService;
        this.signatureRendererService = signatureRendererService;
    }

    @Transactional(readOnly = true)
    public ElectronicSignatureSettingsResponse getSettings() {
        ElectronicSignatureSetting setting = requireSetting();
        return toSettingsResponse(setting, signatureRendererService.renderPreviewText(setting));
    }

    @Transactional
    public ElectronicSignatureSettingsResponse saveSettings(ElectronicSignatureSettingsRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ElectronicSignatureSetting setting = requireSetting();
        String previousAuthMethod = setting.getAllowedAuthMethod();
        boolean previousRequirePassword = setting.isRequirePasswordBeforeSigning();
        boolean previousRequireReason = setting.isRequireReason();
        String previousCommentRule = setting.getCommentRule();
        boolean previousShowAuditTrailSummary = setting.isShowAuditTrailSummary();
        String previousTimestampFormat = setting.getSignatureTimestampFormat();
        String previousTimezone = setting.getSignatureTimezone();
        List<ElectronicSignatureMeaning> previousMeanings = meaningRepository.findAllByOrderBySortOrderAscDisplayNameAsc();
        applySettings(setting, request);
        settingRepository.save(setting);
        if (request != null && request.meanings() != null) {
            saveMeanings(request.meanings());
        }
        List<ElectronicSignatureMeaning> currentMeanings = meaningRepository.findAllByOrderBySortOrderAscDisplayNameAsc();
        auditTrailService.logAs(
                currentUser,
                "ELECTRONIC_SIGNATURE_SETTINGS",
                "Electronic Signature Settings",
                setting.getId(),
                "ELECTRONIC_SIGNATURE_SETTINGS_UPDATED",
                null,
                null,
                "Updated electronic signature settings.",
                List.of(
                        change("Require Password Before Signing", String.valueOf(previousRequirePassword), String.valueOf(setting.isRequirePasswordBeforeSigning())),
                        change("Require Reason", String.valueOf(previousRequireReason), String.valueOf(setting.isRequireReason())),
                        change("Comment Rule", safeText(previousCommentRule), safeText(setting.getCommentRule())),
                        change("Allowed Auth Method", safeText(previousAuthMethod), safeText(setting.getAllowedAuthMethod())),
                        change("Show Audit Trail Summary", String.valueOf(previousShowAuditTrailSummary), String.valueOf(setting.isShowAuditTrailSummary())),
                        change("Signature Timestamp Format", safeText(previousTimestampFormat), safeText(setting.getSignatureTimestampFormat())),
                        change("Signature Timezone", safeText(previousTimezone), safeText(setting.getSignatureTimezone())),
                        change("Meaning Count", String.valueOf(previousMeanings.size()), String.valueOf(currentMeanings.size())),
                        change("Meaning Codes", meaningCodes(previousMeanings), meaningCodes(currentMeanings))
                )
        );
        return toSettingsResponse(setting, signatureRendererService.renderPreviewText(setting));
    }

    @Transactional
    public ElectronicSignature createRevisionSignature(
            DocumentRevisionRecord revision,
            UserAccount user,
            String signatureToken,
            String meaning,
            String reason,
            String comment,
            String oldStatus,
            String newStatus,
            String checksumBefore,
            String checksumAfter
    ) {
        if (revision == null || user == null) {
            throw new IllegalArgumentException("Revision and user are required for electronic signature");
        }
        ElectronicSignatureSetting setting = requireSetting();
        String normalizedMeaning = normalizeMeaning(meaning);
        ElectronicSignatureMeaning meaningConfig = meaningRepository.findByCodeIgnoreCase(normalizedMeaning).orElse(null);
        validateSigningRules(setting, meaningConfig, signatureToken, user, reason, comment);

        ElectronicSignature signature = new ElectronicSignature();
        signature.setEntityType("revisions");
        signature.setEntityId(revision.getId());
        signature.setDocument(revision.getDocument());
        signature.setRevision(revision);
        signature.setUser(user);
        signature.setUsername(user.getUsername());
        signature.setFullName(user.getFullName());
        signature.setPosition(user.getPosition());
        signature.setEmail(user.getEmail());
        signature.setDepartment(user.getDepartment());
        signature.setMeaning(normalizedMeaning);
        signature.setReason(reason);
        signature.setComment(comment);
        signature.setSignedAt(Instant.now());
        signature.setTimezone(displayTimezone(setting));
        signature.setTimestampDisplay(signatureRendererService.formatTimestampSnapshot(signature.getSignedAt(), setting));
        signature.setAuthenticationMethod(setting.getAllowedAuthMethod());
        signature.setSignatureId(nextSignatureId());
        signature.setVerificationId("VERIFY-" + UUID.randomUUID());
        signature.setIpAddress(currentIpAddress());
        signature.setUserAgent(currentUserAgent());
        signature.setDocumentChecksumBeforeSign(checksumBefore);
        signature.setDocumentChecksumAfterSign(checksumAfter);
        signature.setSourceFileVersionId(revision.getSourceStorageVersionId());
        signature.setReviewPdfVersionId(null);
        signature.setPublishedPdfVersionId(null);
        signature.setStatus("SIGNED");
        ElectronicSignature saved = signatureRepository.save(signature);

        auditTrailService.logAs(
                user,
                "REVISION",
                revision.getRevisionName(),
                revision.getId(),
                "DOCUMENT_ELECTRONICALLY_SIGNED",
                oldStatus,
                newStatus,
                "Electronic signature applied: " + saved.getSignatureId(),
                List.of(
                        change("Document Number", revision.getDocumentNumber()),
                        change("Revision Number", revision.getRevisionNumber()),
                        change("User ID", user.getId().toString()),
                        change("Username", user.getUsername()),
                        change("Full Name", user.getFullName()),
                        change("Meaning", normalizedMeaning),
                        change("Reason", reason),
                        change("Comment", comment),
                        change("Signed At", saved.getSignedAt().toString()),
                        change("Auth Method", saved.getAuthenticationMethod()),
                        change("Signature ID", saved.getSignatureId()),
                        change("IP Address", saved.getIpAddress()),
                        change("User Agent", saved.getUserAgent()),
                        change("Checksum Before Sign", checksumBefore),
                        change("Checksum After Sign", checksumAfter),
                        change("Old Status", oldStatus),
                        change("New Status", newStatus)
                ),
                saved.getId()
        );
        return saved;
    }

    @Transactional
    public ElectronicSignature createEntitySignature(
            String entityType,
            UUID entityId,
            String entityName,
            UserAccount user,
            String signatureToken,
            String meaning,
            String reason,
            String comment,
            String oldValue,
            String newValue
    ) {
        if (entityId == null || user == null) {
            throw new IllegalArgumentException("Entity and user are required for electronic signature");
        }
        ElectronicSignatureSetting setting = requireSetting();
        String normalizedMeaning = normalizeMeaning(meaning);
        ElectronicSignatureMeaning meaningConfig = meaningRepository.findByCodeIgnoreCase(normalizedMeaning).orElse(null);
        validateSigningRules(setting, meaningConfig, signatureToken, user, reason, comment);

        ElectronicSignature signature = new ElectronicSignature();
        signature.setEntityType(entityType);
        signature.setEntityId(entityId);
        signature.setUser(user);
        signature.setUsername(user.getUsername());
        signature.setFullName(user.getFullName());
        signature.setPosition(user.getPosition());
        signature.setEmail(user.getEmail());
        signature.setDepartment(user.getDepartment());
        signature.setMeaning(normalizedMeaning);
        signature.setReason(reason);
        signature.setComment(comment);
        signature.setSignedAt(Instant.now());
        signature.setTimezone(displayTimezone(setting));
        signature.setTimestampDisplay(signatureRendererService.formatTimestampSnapshot(signature.getSignedAt(), setting));
        signature.setAuthenticationMethod(setting.getAllowedAuthMethod());
        signature.setSignatureId(nextSignatureId());
        signature.setVerificationId("VERIFY-" + UUID.randomUUID());
        signature.setIpAddress(currentIpAddress());
        signature.setUserAgent(currentUserAgent());
        signature.setStatus("SIGNED");
        ElectronicSignature saved = signatureRepository.save(signature);

        auditTrailService.logAs(
                user,
                entityType,
                entityName,
                entityId,
                "ENTITY_ELECTRONICALLY_SIGNED",
                // fromStatus/toStatus are short lifecycle-state codes (DB column varchar(40)), not a
                // place for free-text oldValue/newValue -- those are already captured below as the
                // "Old Value"/"New Value" change entries. Passing oldValue/newValue here overflowed
                // the column and crashed the INSERT for any signed action with a description longer
                // than 40 chars (e.g. AccessProfileService.removeUser's "Assigned <full name> (<uuid>)").
                null,
                null,
                "Electronic signature applied: " + saved.getSignatureId(),
                List.of(
                        change("Entity Type", entityType),
                        change("Entity ID", entityId.toString()),
                        change("User ID", user.getId().toString()),
                        change("Username", user.getUsername()),
                        change("Full Name", user.getFullName()),
                        change("Meaning", normalizedMeaning),
                        change("Reason", reason),
                        change("Comment", comment),
                        change("Signed At", saved.getSignedAt().toString()),
                        change("Auth Method", saved.getAuthenticationMethod()),
                        change("Signature ID", saved.getSignatureId()),
                        change("Old Value", oldValue),
                        change("New Value", newValue)
                ),
                saved.getId()
        );
        return saved;
    }

    @Transactional(readOnly = true)
    public List<ElectronicSignatureRecordResponse> getRevisionSignatures(UUID revisionId) {
        return signatureRepository.findByRevision_IdOrderBySignedAtAsc(revisionId).stream()
                .map(this::toRecordResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean hasRevisionSignatureMeaning(UUID revisionId, String meaning) {
        if (revisionId == null || !StringUtils.hasText(meaning)) {
            return false;
        }
        return signatureRepository
                .findFirstByRevision_IdAndMeaningIgnoreCaseAndStatusOrderBySignedAtDesc(revisionId, normalizeMeaning(meaning), "SIGNED")
                .isPresent();
    }

    @Transactional(readOnly = true)
    public boolean hasRevisionSignatureMeaning(DocumentRevisionRecord revision, String meaning) {
        return revision != null && hasRevisionSignatureMeaning(revision.getId(), meaning);
    }

    @Transactional(readOnly = true)
    public List<ElectronicSignatureRecordResponse> getEntitySignatures(String entityType, UUID entityId) {
        if (!StringUtils.hasText(entityType) || entityId == null) {
            return List.of();
        }
        String normalizedType = normalizeEntityType(entityType);
        return signatureRepository.findByEntityTypeIgnoreCaseAndEntityIdOrderBySignedAtAsc(normalizedType, entityId).stream()
                .map(this::toRecordResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, String> signaturePlaceholderValues(RevisionDetailResponse revision, List<String> placeholders) {
        Map<String, String> values = new LinkedHashMap<>();
        if (revision == null || !StringUtils.hasText(revision.id()) || placeholders == null || placeholders.isEmpty()) {
            return values;
        }
        UUID revisionId;
        try {
            revisionId = UUID.fromString(revision.id());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Invalid revision id while resolving electronic signature placeholders", ex);
        }
        List<ElectronicSignature> allSignatures = signatureRepository.findByRevision_IdOrderBySignedAtAsc(revisionId);
        List<ElectronicSignature> reviewedSignatures = stageSignatures(allSignatures, "REVIEWED");
        List<ElectronicSignature> approvedSignatures = stageSignatures(allSignatures, "APPROVED");
        List<ParticipantSignatureBlock> reviewerBlocks = buildParticipantSignatureBlocks(revision.reviewers(), reviewedSignatures, "REVIEWED");
        List<ParticipantSignatureBlock> approverBlocks = buildParticipantSignatureBlocks(revision.approvers(), approvedSignatures, "APPROVED");
        for (String placeholder : placeholders) {
            PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(placeholder);
            if (token == null) {
                continue;
            }
            String key = token.key();
            String normalized = token.name().trim().toUpperCase(Locale.ROOT);
            String collapsed = collapsePlaceholderName(normalized);

            if (isReviewerCollectionPlaceholder(collapsed)) {
                values.put(key, renderParticipantSignatureCollection(reviewerBlocks, token.transform()));
                continue;
            }
            if (isApproverCollectionPlaceholder(collapsed)) {
                values.put(key, renderParticipantSignatureCollection(approverBlocks, token.transform()));
                continue;
            }
            if (isReviewerIndexedPlaceholder(collapsed)) {
                values.put(key, renderIndexedParticipantSignature(reviewerBlocks, extractPlaceholderIndex(collapsed), token.transform()));
                continue;
            }
            if (isApproverIndexedPlaceholder(collapsed)) {
                values.put(key, renderIndexedParticipantSignature(approverBlocks, extractPlaceholderIndex(collapsed), token.transform()));
                continue;
            }

            String meaning = meaningFromSignaturePlaceholder(placeholder);
            if (!StringUtils.hasText(meaning)) {
                continue;
            }
            ElectronicSignature signature = signatureRepository
                    .findFirstByRevision_IdAndMeaningIgnoreCaseAndStatusOrderBySignedAtDesc(revisionId, meaning, "SIGNED")
                    .orElse(null);
            if (signature == null) {
                signature = syntheticSignatureFromParticipant(
                        firstParticipantForMeaning(revision, meaning),
                        meaning,
                        meaningStateForFallback(revision, meaning)
                );
            }
            if (signature != null) {
                values.put(key, signatureRendererService.renderTextBlock(signature, requireSetting()));
            }
        }
        return values;
    }

    @Deprecated
    @Transactional(readOnly = true)
    public Map<String, String> signaturePlaceholderValues(UUID revisionId, List<String> placeholders) {
        return new LinkedHashMap<>();
    }

    @Transactional(readOnly = true)
    public String renderSignatureBlock(ElectronicSignature signature) {
        return signatureRendererService.renderTextBlock(signature, requireSetting());
    }

    @Transactional(readOnly = true)
    public String renderPreviewSignatureBlock() {
        return signatureRendererService.renderPreviewText(requireSetting());
    }

    @Transactional(readOnly = true)
    public String previewTimestamp(String format, String timezone) {
        ElectronicSignatureSetting current = requireSetting();
        ElectronicSignatureSetting preview = new ElectronicSignatureSetting();
        preview.setSignatureTimestampFormat(signatureRendererService.normalizeTimestampFormat(format));
        String zone = StringUtils.hasText(timezone) ? timezone.trim() : current.getSignatureTimezone();
        try { java.time.ZoneId.of(zone); }
        catch (Exception ex) { throw new IllegalArgumentException("Unsupported signature timezone: " + zone); }
        preview.setSignatureTimezone(zone);
        return signatureRendererService.formatTimestampSnapshot(Instant.now(), preview);
    }

    public Double getDisplayFontSizePt() {
        return 8.5;
    }

    /**
     * Returns only the non-sensitive signing policy for a workflow meaning. This
     * is intentionally separate from the admin settings endpoint so ordinary
     * signers can render the same allowed-reason choices enforced by the server.
     */
    @Transactional(readOnly = true)
    public ElectronicSignatureMeaningResponse getMeaningPolicy(String code) {
        if (!StringUtils.hasText(code)) return null;
        return meaningRepository.findByCodeIgnoreCase(normalizeMeaning(code))
                .map(this::toMeaningResponse)
                .orElse(null);
    }

    public String getDisplayStyle() {
        return "DETAILED_TABLE";
    }

    private void validateSigningRules(ElectronicSignatureSetting setting, ElectronicSignatureMeaning meaning, String signatureToken, UserAccount user, String reason, String comment) {
        var parsed = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new UnauthorizedException("Electronic signature is invalid or expired"));
        if (!parsed.principal().userId().equals(user.getId())) {
            throw new UnauthorizedException("Electronic signature must belong to the current user");
        }
        boolean reasonRequired = setting.isRequireReason() || (meaning != null && meaning.isRequiresReason());
        if (reasonRequired && !StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("Signing reason is required");
        }
        if (meaning != null && meaning.getAllowedReasons() != null && !meaning.getAllowedReasons().isEmpty()
                && StringUtils.hasText(reason)
                && meaning.getAllowedReasons().stream().noneMatch(item -> item.equalsIgnoreCase(reason.trim()))) {
            throw new IllegalArgumentException("Signing reason is not allowed for this signature meaning");
        }
        boolean commentRequired = "REQUIRED".equalsIgnoreCase(setting.getCommentRule()) || (meaning != null && meaning.isRequiresComment());
        if (commentRequired && !StringUtils.hasText(comment)) {
            throw new IllegalArgumentException("Signing comment is required");
        }
    }

    private ElectronicSignatureSetting requireSetting() {
        return settingRepository.findById(ElectronicSignatureSetting.DEFAULT_ID)
                .orElseGet(() -> settingRepository.save(new ElectronicSignatureSetting()));
    }

    private void applySettings(ElectronicSignatureSetting setting, ElectronicSignatureSettingsRequest request) {
        if (request == null) return;
        if (request.requirePasswordBeforeSigning() != null) setting.setRequirePasswordBeforeSigning(request.requirePasswordBeforeSigning());
        if (request.requireReason() != null) setting.setRequireReason(request.requireReason());
        if (StringUtils.hasText(request.commentRule())) setting.setCommentRule(normalizeCommentRule(request.commentRule()));
        // Electronic signatures are intentionally password-only. Login MFA/SSO remains
        // an account security feature, but is not an alternative signing mechanism.
        setting.setAllowedAuthMethod("PASSWORD");
        if (request.showAuditTrailSummary() != null) setting.setShowAuditTrailSummary(request.showAuditTrailSummary());
        if (StringUtils.hasText(request.signatureTimestampFormat())) {
            setting.setSignatureTimestampFormat(signatureRendererService.normalizeTimestampFormat(request.signatureTimestampFormat()));
        }
        if (StringUtils.hasText(request.signatureTimezone())) {
            String timezone = request.signatureTimezone().trim();
            try { java.time.ZoneId.of(timezone); }
            catch (Exception ex) { throw new IllegalArgumentException("Unsupported signature timezone: " + timezone); }
            setting.setSignatureTimezone(timezone);
        }
        setting.setTimestampFormatEffectiveFrom(Instant.now());
    }

    private void saveMeanings(List<ElectronicSignatureMeaningRequest> requests) {
        int order = 10;
        for (ElectronicSignatureMeaningRequest item : requests) {
            if (item == null || !StringUtils.hasText(item.code())) continue;
            ElectronicSignatureMeaning meaning = meaningRepository.findByCodeIgnoreCase(item.code()).orElseGet(ElectronicSignatureMeaning::new);
            meaning.setCode(normalizeMeaning(item.code()));
            meaning.setDisplayName(StringUtils.hasText(item.displayName()) ? item.displayName().trim() : meaning.getCode());
            meaning.setDescription(item.description());
            meaning.setRequiresReason(item.requiresReason() == null || item.requiresReason());
            if (StringUtils.hasText(item.commentRule())) {
                meaning.setCommentRule(normalizeCommentRule(item.commentRule()));
            } else if (item.requiresComment() != null) {
                meaning.setCommentRule(Boolean.TRUE.equals(item.requiresComment()) ? "REQUIRED" : "OPTIONAL");
            }
            if (item.allowedReasons() != null) {
                meaning.setAllowedReasons(item.allowedReasons().stream().filter(StringUtils::hasText).toList());
            }
            meaning.setActive(item.active() == null || item.active());
            meaning.setSortOrder(order);
            meaningRepository.save(meaning);
            order += 10;
        }
    }

    private ElectronicSignatureSettingsResponse toSettingsResponse(ElectronicSignatureSetting setting, String previewBlock) {
        return new ElectronicSignatureSettingsResponse(
                setting.isRequirePasswordBeforeSigning(),
                setting.isRequireReason(),
                setting.getCommentRule(),
                setting.getAllowedAuthMethod(),
                setting.isShowAuditTrailSummary(),
                StringUtils.hasText(setting.getSignatureTimestampFormat()) ? setting.getSignatureTimestampFormat() : "dd-MMM-uuuu HH:mm:ss",
                StringUtils.hasText(setting.getSignatureTimezone()) ? setting.getSignatureTimezone() : "Asia/Ho_Chi_Minh",
                setting.getTimestampFormatEffectiveFrom(),
                meaningRepository.findAllByOrderBySortOrderAscDisplayNameAsc().stream().map(this::toMeaningResponse).toList(),
                previewBlock
        );
    }

    private ElectronicSignatureMeaningResponse toMeaningResponse(ElectronicSignatureMeaning meaning) {
        return new ElectronicSignatureMeaningResponse(
                meaning.getId(),
                meaning.getCode(),
                meaning.getDisplayName(),
                meaning.getDescription(),
                meaning.isRequiresReason(),
                meaning.isRequiresComment(),
                meaning.isActive(),
                meaning.getCommentRule(),
                meaning.getAllowedReasons()
        );
    }

    private ElectronicSignatureRecordResponse toRecordResponse(ElectronicSignature signature) {
        return new ElectronicSignatureRecordResponse(
                signature.getId(),
                signature.getEntityType(),
                signature.getEntityId(),
                signature.getDocument() == null ? null : signature.getDocument().getId(),
                signature.getRevision() == null ? null : signature.getRevision().getId(),
                signature.getWorkflowStepId(),
                signature.getUser() == null ? null : signature.getUser().getId(),
                signature.getUsername(),
                signature.getFullName(),
                signature.getPosition(),
                signature.getEmail(),
                signature.getDepartment(),
                signature.getMeaning(),
                displayMeaning(signature.getMeaning()),
                signature.getReason(),
                signature.getComment(),
                signature.getSignedAt(),
                signature.getTimezone(),
                signature.getAuthenticationMethod(),
                signature.getSignatureId(),
                signature.getVerificationId(),
                signature.getStatus(),
                signature.getIpAddress(),
                signature.getUserAgent(),
                signature.getDocumentChecksumBeforeSign(),
                signature.getDocumentChecksumAfterSign(),
                signature.getSourceFileVersionId(),
                signature.getReviewPdfVersionId(),
                signature.getPublishedPdfVersionId(),
                signature.getCreatedAt()
        );
    }

    private String meaningCodes(List<ElectronicSignatureMeaning> meanings) {
        if (meanings == null || meanings.isEmpty()) {
            return "";
        }
        return meanings.stream()
                .map(ElectronicSignatureMeaning::getCode)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList()
                .toString();
    }

    private String safeText(String value) {
        return StringUtils.hasText(value) ? value : "";
    }

    private AuditTrailChangeResponse change(String field, String value) {
        return new AuditTrailChangeResponse(field, "-", valueOrDash(value));
    }

    private AuditTrailChangeResponse change(String field, String oldValue, String newValue) {
        return new AuditTrailChangeResponse(field, valueOrDash(oldValue), valueOrDash(newValue));
    }

    private String nextSignatureId() {
        long next = signatureRepository.nextSignatureSequence();
        return "ESIG-" + SIGNATURE_ID_YEAR.format(Instant.now()) + "-" + String.format("%06d", next);
    }

    private String displayMeaning(String code) {
        return meaningRepository.findByCodeIgnoreCase(normalizeMeaning(code))
                .map(ElectronicSignatureMeaning::getDisplayName)
                .orElseGet(() -> humanize(code));
    }

    private String meaningFromSignaturePlaceholder(String placeholder) {
        if (!StringUtils.hasText(placeholder)) return null;
        PublishingPlaceholderSyntax.PlaceholderToken token = PublishingPlaceholderSyntax.parse(placeholder);
        String normalized = (token == null ? placeholder : token.name()).trim().toUpperCase(Locale.ROOT);
        String stripped = normalized
                .replaceAll("([_\\-\\s]?SIGNATURE)$", "")
                .replaceAll("([_\\-\\s]?BLOCK)$", "")
                .replaceAll("([_\\-\\s]?DISPLAY)$", "")
                .trim();
        if (stripped.equals(normalized)) {
            // No SIGNATURE/BLOCK/DISPLAY suffix was actually present, so this is a plain value
            // placeholder (e.g. {{authorName}}, {{checkedBy}}, {{reviewers}}) — not a signature
            // alias. Do not hijack its value with an electronic-signature block rendering; the
            // case labels below only apply to what remains after a real suffix was stripped.
            return null;
        }
        String collapsed = stripped.replaceAll("[_\\-\\s]+", "");
        return switch (collapsed) {
            case "PREPARED", "AUTHOR", "AUTHORNAME", "PREPAREDBY", "PREPAREDBYNAME" ->
                    "PREPARED";
            case "DCO", "SUBMITTED", "SUBMITTEDFORREVIEW", "SUBMITTEDBY", "SUBMITTEDBYUSERNAME" ->
                    "SUBMITTED_FOR_REVIEW";
            case "REVIEWED", "CHECKEDBY", "REVIEWEDBY" -> "REVIEWED";
            case "APPROVED" -> "APPROVED";
            case "TRAININGCONFIRMED" -> "TRAINING_CONFIRMED";
            case "PUBLISHED" -> "PUBLISHED";
            case "OBSOLETED" -> "OBSOLETED";
            case "CANCELLED" -> "CANCELLED";
            case "REVIEWER", "REVIEWERS" -> "REVIEWED";
            case "APPROVER", "APPROVERS" -> "APPROVED";
            default -> null;
        };
    }

    private List<ElectronicSignature> stageSignatures(List<ElectronicSignature> signatures, String meaning) {
        if (signatures == null || signatures.isEmpty() || !StringUtils.hasText(meaning)) {
            return List.of();
        }
        return signatures.stream()
                .filter(signature -> signature != null && meaning.equalsIgnoreCase(normalizeMeaning(signature.getMeaning())))
                .sorted(Comparator.comparing(ElectronicSignature::getSignedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private List<DocumentParticipantResponse> orderedParticipants(List<DocumentParticipantResponse> participants) {
        if (participants == null || participants.isEmpty()) {
            return List.of();
        }
        return participants.stream()
                .filter(participant -> participant != null)
                .sorted(Comparator.comparing(DocumentParticipantResponse::sequenceOrder, Comparator.nullsLast(Integer::compareTo)))
                .toList();
    }

    private List<ParticipantSignatureBlock> buildParticipantSignatureBlocks(
            List<DocumentParticipantResponse> participants,
            List<ElectronicSignature> signatures,
            String meaning
    ) {
        List<DocumentParticipantResponse> ordered = orderedParticipants(participants);
        List<ElectronicSignature> stageSignatures = signatures == null ? List.of() : signatures;
        List<ParticipantSignatureBlock> blocks = new ArrayList<>();
        Set<UUID> usedSignatureIds = new HashSet<>();
        for (int i = 0; i < ordered.size(); i++) {
            DocumentParticipantResponse participant = ordered.get(i);
            ElectronicSignature signature = matchSignatureForParticipant(participant, stageSignatures, usedSignatureIds);
            blocks.add(new ParticipantSignatureBlock(i + 1, participant, signature, meaning));
            if (signature != null && signature.getId() != null) {
                usedSignatureIds.add(signature.getId());
            }
        }
        for (ElectronicSignature signature : stageSignatures) {
            if (signature == null || (signature.getId() != null && usedSignatureIds.contains(signature.getId()))) {
                continue;
            }
            blocks.add(new ParticipantSignatureBlock(blocks.size() + 1, null, signature, meaning));
        }
        return blocks;
    }

    private ElectronicSignature matchSignatureForParticipant(
            DocumentParticipantResponse participant,
            List<ElectronicSignature> signatures,
            Set<UUID> usedSignatureIds
    ) {
        if (participant == null || signatures == null || signatures.isEmpty()) {
            return null;
        }
        String participantUsername = normalizeParticipantKey(participant.username());
        String participantFullName = normalizeParticipantKey(participant.fullName());
        String participantEmail = normalizeParticipantKey(participant.email());
        for (ElectronicSignature signature : signatures) {
            if (signature == null) {
                continue;
            }
            UUID signatureId = signature.getId();
            if (signatureId != null && usedSignatureIds.contains(signatureId)) {
                continue;
            }
            if (matchesParticipant(signature.getUsername(), participantUsername)
                    || matchesParticipant(signature.getFullName(), participantFullName)
                    || matchesParticipant(signature.getEmail(), participantEmail)) {
                return signature;
            }
        }
        return null;
    }

    private boolean matchesParticipant(String signatureValue, String participantValue) {
        return StringUtils.hasText(signatureValue) && StringUtils.hasText(participantValue)
                && normalizeParticipantKey(signatureValue).equals(participantValue);
    }

    private String normalizeParticipantKey(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
    }

    private String renderParticipantSignatureCollection(List<ParticipantSignatureBlock> blocks, String transform) {
        if (blocks == null || blocks.isEmpty()) {
            return applyTransform("-", transform);
        }
        return blocks.stream()
                .map(this::renderParticipantSignatureBlock)
                .filter(StringUtils::hasText)
                .collect(java.util.stream.Collectors.joining("\n\n"));
    }

    private String renderIndexedParticipantSignature(List<ParticipantSignatureBlock> blocks, Integer index, String transform) {
        if (blocks == null || blocks.isEmpty() || index == null || index < 1 || index > blocks.size()) {
            return applyTransform("-", transform);
        }
        return renderParticipantSignatureBlock(blocks.get(index - 1));
    }

    private String renderParticipantSignatureBlock(ParticipantSignatureBlock block) {
        if (block == null) {
            return "-";
        }
        ElectronicSignature signature = block.signature();
        DocumentParticipantResponse participant = block.participant();
        String status = resolveParticipantDisplayStatus(participant, signature);
        ElectronicSignature display = signature == null ? new ElectronicSignature() : signature;
        if (!StringUtils.hasText(display.getFullName()) && participant != null) {
            display.setFullName(valueOrDash(participant.fullName()));
        }
        if (!StringUtils.hasText(display.getUsername()) && participant != null) {
            display.setUsername(valueOrDash(participant.username()));
        }
        if (!StringUtils.hasText(display.getPosition()) && participant != null) {
            display.setPosition(valueOrDash(participant.position()));
        }
        if (!StringUtils.hasText(display.getEmail()) && participant != null) {
            display.setEmail(valueOrDash(participant.email()));
        }
        if (!StringUtils.hasText(display.getDepartment()) && participant != null) {
            display.setDepartment(valueOrDash(participant.department()));
        }
        if (!StringUtils.hasText(display.getMeaning())) {
            display.setMeaning(block.meaning());
        }
        if (!StringUtils.hasText(display.getReason()) && participant != null) {
            display.setReason(valueOrDash(participant.actionComment()));
        }
        if (!StringUtils.hasText(display.getComment()) && participant != null) {
            display.setComment(valueOrDash(participant.actionComment()));
        }
        if (!StringUtils.hasText(display.getStatus())) {
            display.setStatus(status);
        } else {
            display.setStatus(status);
        }
        if (display.getSignedAt() == null && participant != null && StringUtils.hasText(participant.actedAt()) && "SIGNED".equalsIgnoreCase(status)) {
            try {
                display.setSignedAt(Instant.parse(participant.actedAt()));
            } catch (Exception ignored) {
                // keep preview-friendly fallback
            }
        }
        if (!StringUtils.hasText(display.getTimezone())) {
            display.setTimezone(displayTimezone(requireSetting()));
        }
        return signatureRendererService.renderTextBlock(display, requireSetting());
    }

    private String resolveParticipantDisplayStatus(DocumentParticipantResponse participant, ElectronicSignature signature) {
        String signatureStatus = normalizeSignatureStatus(signature == null ? null : signature.getStatus());
        if ("PENDING".equals(signatureStatus) || "FAILED".equals(signatureStatus) || "INVALID".equals(signatureStatus) || "REJECTED".equals(signatureStatus)) {
            return signatureStatus;
        }
        String actionStatus = participant == null ? null : participant.actionStatus();
        if (!StringUtils.hasText(actionStatus)) {
            return "SIGNED";
        }
        String normalized = actionStatus.trim().toUpperCase(Locale.ROOT);
        if ("PENDING".equals(normalized)) {
            return "PENDING";
        }
        if ("REJECTED".equals(normalized) || "FAILED".equals(normalized) || "INVALID".equals(normalized)) {
            return "FAILED";
        }
        return "SIGNED";
    }

    private DocumentParticipantResponse firstParticipantForMeaning(RevisionDetailResponse revision, String meaning) {
        if (revision == null || !StringUtils.hasText(meaning)) {
            return null;
        }
        if ("REVIEWED".equalsIgnoreCase(meaning)) {
            return orderedParticipants(revision.reviewers()).stream().findFirst().orElse(null);
        }
        if ("APPROVED".equalsIgnoreCase(meaning)) {
            return orderedParticipants(revision.approvers()).stream().findFirst().orElse(null);
        }
        if ("SUBMITTED_FOR_REVIEW".equalsIgnoreCase(meaning)) {
            return null;
        }
        return null;
    }

    private String meaningStateForFallback(RevisionDetailResponse revision, String meaning) {
        if (revision == null || !StringUtils.hasText(meaning)) {
            return "SIGNED";
        }
        if ("REVIEWED".equalsIgnoreCase(meaning)) {
            return orderedParticipants(revision.reviewers()).stream()
                    .findFirst()
                    .map(participant -> resolveParticipantDisplayStatus(participant, null))
                    .orElse("SIGNED");
        }
        if ("APPROVED".equalsIgnoreCase(meaning)) {
            return orderedParticipants(revision.approvers()).stream()
                    .findFirst()
                    .map(participant -> resolveParticipantDisplayStatus(participant, null))
                    .orElse("SIGNED");
        }
        return "SIGNED";
    }

    private ElectronicSignature syntheticSignatureFromParticipant(DocumentParticipantResponse participant, String meaning, String status) {
        if (participant == null) {
            return null;
        }
        ElectronicSignature synthetic = new ElectronicSignature();
        synthetic.setFullName(participant.fullName());
        synthetic.setUsername(participant.username());
        synthetic.setPosition(participant.position());
        synthetic.setEmail(participant.email());
        synthetic.setDepartment(participant.department());
        synthetic.setMeaning(meaning);
        synthetic.setReason(participant.actionComment());
        synthetic.setComment(participant.actionComment());
        synthetic.setStatus(StringUtils.hasText(status) ? status : "SIGNED");
        synthetic.setTimezone(displayTimezone(requireSetting()));
        return synthetic;
    }

    private String collapsePlaceholderName(String normalized) {
        return normalized == null ? "" : normalized.replaceAll("[_\\-\\s]+", "");
    }

    private boolean isReviewerCollectionPlaceholder(String collapsed) {
        return "REVIEWERSIGNATURES".equalsIgnoreCase(collapsed);
    }

    private boolean isApproverCollectionPlaceholder(String collapsed) {
        return "APPROVERSIGNATURES".equalsIgnoreCase(collapsed);
    }

    private boolean isReviewerIndexedPlaceholder(String collapsed) {
        return collapsed != null && Pattern.compile("^REVIEWERSIGNATURE\\d+$", Pattern.CASE_INSENSITIVE).matcher(collapsed).matches();
    }

    private boolean isApproverIndexedPlaceholder(String collapsed) {
        return collapsed != null && Pattern.compile("^APPROVERSIGNATURE\\d+$", Pattern.CASE_INSENSITIVE).matcher(collapsed).matches();
    }

    private Integer extractPlaceholderIndex(String collapsed) {
        if (!StringUtils.hasText(collapsed)) {
            return null;
        }
        String digits = collapsed.replaceAll("^.*?(\\d+)$", "$1");
        if (!StringUtils.hasText(digits) || digits.equals(collapsed)) {
            return null;
        }
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private record ParticipantSignatureBlock(int sequence, DocumentParticipantResponse participant, ElectronicSignature signature, String meaning) {
    }

    private String normalizeMeaning(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_') : "SIGNED";
    }

    private String normalizeSignatureStatus(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "";
    }

    private String normalizeEntityType(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : "";
    }


    private String normalizeCommentRule(String value) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "OPTIONAL";
        return List.of("OPTIONAL", "REQUIRED", "HIDDEN").contains(normalized) ? normalized : "OPTIONAL";
    }

    private String normalizeAuthMethod(String value) {
        return "PASSWORD";
    }

    private String displayTimezone(ElectronicSignatureSetting setting) {
        return StringUtils.hasText(setting.getSignatureTimezone()) ? setting.getSignatureTimezone() : "Asia/Ho_Chi_Minh";
    }

    private String applyTransform(String value, String transform) {
        return PublishingPlaceholderSyntax.applyTransform(value, transform);
    }

    private String currentIpAddress() {
        HttpServletRequest request = currentRequest();
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String currentUserAgent() {
        HttpServletRequest request = currentRequest();
        return request == null ? null : request.getHeader("User-Agent");
    }

    private HttpServletRequest currentRequest() {
        var attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletAttributes) {
            return servletAttributes.getRequest();
        }
        return null;
    }

    private String valueOrDash(String value) {
        return StringUtils.hasText(value) ? value : "-";
    }

    private String humanize(String value) {
        if (!StringUtils.hasText(value)) return "-";
        String lower = value.toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
