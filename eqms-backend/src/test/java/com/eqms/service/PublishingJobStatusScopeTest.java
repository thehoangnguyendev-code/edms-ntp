package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.*;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.PublishingWorkspaceJobRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublishingJobStatusScopeTest {
    @Test void aJobFromAnotherRevisionCannotBeReadAndFileStorageIsNeverUsedForPolling() {
        var service=mock(PublishingWorkspaceService.class,CALLS_REAL_METHODS);
        var current=mock(CurrentUserService.class); var revisions=mock(DocumentRevisionRepository.class);
        var jobs=mock(PublishingWorkspaceJobRepository.class); var access=mock(DocumentAuthorizationService.class);
        var storage=mock(FileStorageService.class);
        ReflectionTestUtils.setField(service,"currentUserService",current);
        ReflectionTestUtils.setField(service,"revisionRepository",revisions);
        ReflectionTestUtils.setField(service,"publishingWorkspaceJobRepository",jobs);
        ReflectionTestUtils.setField(service,"documentAuthorizationService",access);
        ReflectionTestUtils.setField(service,"fileStorageService",storage);
        var actor=new UserAccount(); actor.setId(UUID.randomUUID());
        var revision=new DocumentRevisionRecord(); revision.setId(UUID.randomUUID());
        var job=new PublishingWorkspaceJob();job.setId(UUID.randomUUID());job.setRevisionId(UUID.randomUUID());job.setStatus("COMPLETED");
        when(current.requireCurrentUser()).thenReturn(actor);when(revisions.findById(revision.getId())).thenReturn(Optional.of(revision));
        when(jobs.findById(job.getId())).thenReturn(Optional.of(job));
        assertThrows(IllegalArgumentException.class,()->service.getJobStatus(revision.getId(),job.getId()));
        job.setRevisionId(revision.getId());
        assertEquals("COMPLETED",service.getJobStatus(revision.getId(),job.getId()).publishingJobStatus());
        doThrow(new AccessDeniedException("denied")).when(access).requireCanViewRevision(actor,revision);
        assertThrows(AccessDeniedException.class,()->service.getJobStatus(revision.getId(),job.getId()));
        verifyNoInteractions(storage);
    }
}
