package com.eqms.dto;

import com.eqms.dto.document.*;
import com.eqms.dto.uncontrolledcopy.UncontrolledCopyResponse;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * STATUS-CONTRACT-2026-11-14: a Document Control answer that shows a status (`status`, the words for people) also gives its machine code (`statusCode`, e.g. CLOSED_CANCELLED).
 * Every decision of a client is taken on the code, never on the words.
 */
class StatusCodeContractTest {
    private static final List<Class<?>> LIFECYCLE_ANSWERS = List.of(DocumentDetailResponse.class, DocumentListItemResponse.class, DocumentRelationResponse.class,
            DocumentRevisionSummaryResponse.class, OriginalDocumentResponse.class, RevisionDetailResponse.class, RevisionListItemResponse.class,
            RevisionUpgradeImpactItemResponse.class, ControlledCopyListItemResponse.class, UncontrolledCopyResponse.class);

    private static boolean has(Class<?> type, String name) {
        return Arrays.stream(type.getRecordComponents()).anyMatch(component -> component.getName().equals(name));
    }

    @Test
    void everyDocumentControlAnswerThatShowsAStatusAlsoGivesItsCode() {
        for (Class<?> type : LIFECYCLE_ANSWERS) {
            assertTrue(has(type, "status"), type.getSimpleName() + " shows a status");
            assertTrue(has(type, "statusCode"), type.getSimpleName() + " must also give statusCode");
        }
    }

    @Test
    void theLabelAndTheCodeOfALifecycleStatusAreNotTheSameField() {
        for (Class<?> type : LIFECYCLE_ANSWERS) {
            long statusFields = Arrays.stream(type.getRecordComponents()).filter(component -> component.getName().equals("status") || component.getName().equals("statusCode")).count();
            assertTrue(statusFields == 2, type.getSimpleName() + " has both status and statusCode");
        }
    }
}
