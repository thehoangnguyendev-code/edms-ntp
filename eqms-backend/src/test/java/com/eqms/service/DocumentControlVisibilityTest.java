package com.eqms.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentControlVisibilityTest {

    @Test
    void noViewAllPermissionMeansAPersonSeesOnlyWhatHasTheirName() {
        assertThat(DocumentControlVisibility.classify(Set.of("documents.module.view", "documents.document.view")))
                .isEqualTo(DocumentControlVisibility.NAMED_IN_FLOW);
        assertThat(DocumentControlVisibility.classify(null)).isEqualTo(DocumentControlVisibility.NAMED_IN_FLOW);
        assertThat(DocumentControlVisibility.classify(List.of())).isEqualTo(DocumentControlVisibility.NAMED_IN_FLOW);
    }

    @Test
    void allThreeViewAllPermissionsMeanViewEverything() {
        assertThat(DocumentControlVisibility.classify(List.of(
                "documents.document.view_all", "documents.controlled_copy.view_all", "documents.uncontrolled_copy.view_all", "documents.workspace.manage")))
                .isEqualTo(DocumentControlVisibility.VIEW_EVERYTHING);
    }

    @Test
    void oneOrTwoOfThemAreIncomplete() {
        assertThat(DocumentControlVisibility.classify(Set.of("documents.uncontrolled_copy.view_all"))).isEqualTo(DocumentControlVisibility.INCOMPLETE);
        assertThat(DocumentControlVisibility.classify(Set.of("documents.document.view_all", "documents.controlled_copy.view_all")))
                .isEqualTo(DocumentControlVisibility.INCOMPLETE);
    }

    @Test
    void codesAreComparedWithoutRegardToCaseAndSurroundingSpace() {
        assertThat(DocumentControlVisibility.classify(List.of(" DOCUMENTS.DOCUMENT.VIEW_ALL ", "Documents.Controlled_Copy.View_All", "documents.uncontrolled_copy.view_all")))
                .isEqualTo(DocumentControlVisibility.VIEW_EVERYTHING);
    }

    @Test
    void theBundleIsTheThreeCodesOfTheDocumentAuthorizationService() {
        assertThat(DocumentControlVisibility.VIEW_ALL_PERMISSIONS).containsExactly(
                DocumentAuthorizationService.PERMISSION_DOCUMENT_VIEW_ALL,
                DocumentAuthorizationService.PERMISSION_CONTROLLED_COPY_VIEW_ALL,
                DocumentAuthorizationService.PERMISSION_UNCONTROLLED_COPY_VIEW_ALL);
    }
}
