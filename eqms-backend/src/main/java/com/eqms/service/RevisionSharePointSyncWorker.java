package com.eqms.service;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.repository.DocumentRevisionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.UUID;

@Service
public class RevisionSharePointSyncWorker {

    private static final Logger log = LoggerFactory.getLogger(RevisionSharePointSyncWorker.class);

    private final DocumentRevisionRepository revisionRepository;
    private final MicrosoftGraphStorageService microsoftGraphStorageService;

    public RevisionSharePointSyncWorker(
            DocumentRevisionRepository revisionRepository,
            MicrosoftGraphStorageService microsoftGraphStorageService
    ) {
        this.revisionRepository = revisionRepository;
        this.microsoftGraphStorageService = microsoftGraphStorageService;
    }

    @Async
    @Transactional
    public void syncRevisionAsync(UUID revisionId) {
        if (revisionId == null) {
            return;
        }

        DocumentRevisionRecord revision = revisionRepository.findById(revisionId).orElse(null);
        if (revision == null || !StringUtils.hasText(revision.getFilePath())) {
            return;
        }

        try {
            MicrosoftGraphStorageService.SharePointSyncResult syncResult = microsoftGraphStorageService.syncRevisionFile(revision);
            if (syncResult == null) {
                revision.setStorageSyncStatus("FAILED");
                revisionRepository.save(revision);
                return;
            }

            revision.setStorageProvider(syncResult.configured() ? "MICROSOFT_SHAREPOINT" : "LOCAL");
            revision.setStorageSiteId(syncResult.siteId());
            revision.setStorageDriveId(syncResult.driveId());
            revision.setStorageItemId(syncResult.itemId());
            revision.setStorageWebUrl(syncResult.webUrl());
            revision.setStorageEditUrl(syncResult.editUrl());
            revision.setStorageViewUrl(syncResult.viewUrl());
            revision.setStoragePdfUrl(syncResult.previewUrl());
            revision.setStorageSyncStatus(syncResult.status());
            revision.setStorageLastSyncedAt(syncResult.synced() ? Instant.now() : null);
            revisionRepository.save(revision);
        } catch (Exception ex) {
            log.warn("Failed to sync revision {} to SharePoint: {}", revisionId, ex.getMessage(), ex);
            revision.setStorageSyncStatus("FAILED");
            revisionRepository.save(revision);
        }
    }
}
