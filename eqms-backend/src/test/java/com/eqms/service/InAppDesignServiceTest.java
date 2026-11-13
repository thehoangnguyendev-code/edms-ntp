package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.InAppDesign;
import com.eqms.entity.UserAccount;
import com.eqms.repository.InAppDesignRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InAppDesignServiceTest {
    private InAppDesignRepository repository;
    private AuditTrailService audit;
    private InAppDesignService service;
    private InAppDesign row;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        repository = mock(InAppDesignRepository.class);
        audit = mock(AuditTrailService.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        actor = new UserAccount();
        actor.setUsername("admin");
        when(currentUser.requireCurrentUser()).thenReturn(actor);
        service = new InAppDesignService(repository, audit, currentUser);
        row = new InAppDesign();
        row.setId(java.util.UUID.randomUUID());
        when(repository.lockCurrent()).thenReturn(Optional.of(row));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    private static InAppDesignService.Change change(String position, int seconds, String color, int shadow) {
        return new InAppDesignService.Change(position, seconds, color, shadow);
    }

    @Test
    void aValidDesignIsAccepted() {
        for (String position : InAppDesignService.POSITIONS) assertDoesNotThrow(() -> InAppDesignService.validate(change(position, 5, "#3B82F6", 40)), position);
        assertDoesNotThrow(() -> InAppDesignService.validate(change("top-center", 2, "#a855f7", 0)));
        assertDoesNotThrow(() -> InAppDesignService.validate(change("bottom-center", 60, "#000000", 100)));
    }

    @Test
    void everyFieldOutsideItsRangeIsRefused() {
        for (InAppDesignService.Change bad : new InAppDesignService.Change[] {
                change("nowhere", 5, "#3B82F6", 40), change(null, 5, "#3B82F6", 40), change("top-right", 1, "#3B82F6", 40), change("top-right", 61, "#3B82F6", 40),
                change("top-right", 5, "blue", 40), change("top-right", 5, "#fff", 40), change("top-right", 5, "#3B82F6; x", 40), change("top-right", 5, null, 40),
                change("top-right", 5, "#3B82F6", -1), change("top-right", 5, "#3B82F6", 101)}) {
            assertThrows(IllegalArgumentException.class, () -> InAppDesignService.validate(bad), bad.toString());
        }
    }

    @Test
    void aChangeBumpsTheVersionNamesWhoDidItAndIsWrittenToTheAuditTrailWithBeforeAndAfter() {
        InAppDesign saved = service.update(change("bottom-center", 8, "#d946ef", 70), 1);
        assertEquals(2, saved.getVersion());
        assertEquals("#D946EF", saved.getToastColor());
        assertEquals("admin", saved.getUpdatedBy());
        verify(audit).logAs(eq(actor), eq("IN_APP_DESIGN"), anyString(), any(), eq("UPDATE"), any(), any(), anyString(), org.mockito.ArgumentMatchers.<java.util.List<com.eqms.dto.audittrail.AuditTrailChangeResponse>>any());
    }

    @Test
    void aSaveWithNothingChangedLeavesTheVersionAndWritesNothing() {
        InAppDesign saved = service.update(change(row.getToastPosition(), row.getToastDurationSeconds(), row.getToastColor(), row.getToastShadow()), 1);
        assertSame(row, saved);
        assertEquals(1, saved.getVersion());
        verify(repository, never()).save(any());
    }

    @Test
    void aSaveAfterSomeoneElseSavedIsRefusedAndNothingIsOverwritten() {
        row.setVersion(3);
        IllegalStateException refused = assertThrows(IllegalStateException.class, () -> service.update(change("top-left", 5, "#3B82F6", 40), 2));
        assertEquals("This was changed by someone else after you opened it. Reload it to see their change, then make yours again.", refused.getMessage());
        verify(repository, never()).save(any());
    }

    @Test
    void anInvalidChangeIsRefusedBeforeAnythingIsRead() {
        assertThrows(IllegalArgumentException.class, () -> service.update(change("top-left", 5, "red", 40), 1));
        verify(repository, never()).lockCurrent();
    }
}
