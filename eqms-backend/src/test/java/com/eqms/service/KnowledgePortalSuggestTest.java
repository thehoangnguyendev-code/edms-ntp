package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.knowledge.KnowledgePortalDtos.DocumentSuggestion;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentType;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/** The auto-complete of the Knowledge search box reads only what the user may see in the Knowledge Base. */
class KnowledgePortalSuggestTest {
    private final DocumentService documentService = mock(DocumentService.class);
    private KnowledgePortalService service;
    private final List<DocumentService.KnowledgeEntry> visible = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new KnowledgePortalService(documentService, mock(KnowledgeCategoryHierarchyRepository.class), mock(CurrentUserService.class),
                mock(PermissionEvaluationService.class), mock(AuditTrailService.class), mock(JdbcTemplate.class),
                mock(SystemConfigurationService.class), mock(KnowledgeComponentService.class));
        when(documentService.visibleKnowledgeEntries()).thenReturn(visible);
    }

    private DocumentService.KnowledgeEntry entry(String number, String name) {
        DocumentRecord document = new DocumentRecord();
        ReflectionTestUtils.setField(document, "id", UUID.randomUUID());
        document.setDocumentNumber(number);
        document.setDocumentName(name);
        DocumentType type = new DocumentType();
        type.setName("SOP");
        document.setDocumentType(type);
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setRevisionNumber("1.0");
        DocumentService.KnowledgeEntry entry = new DocumentService.KnowledgeEntry(document, revision);
        visible.add(entry);
        return entry;
    }

    @Test
    void aDocumentTheUserMayNotSeeIsNeverSuggestedBecauseOnlyTheVisibleListIsRead() {
        // the visible list holds one document; a document with a matching name that is NOT in it cannot appear
        entry("SOP.0001", "Balance calibration");
        List<DocumentSuggestion> found = service.suggest("calib", 8);
        assertThat(found).extracting(DocumentSuggestion::documentNumber).containsExactly("SOP.0001");
        verify(documentService).visibleKnowledgeEntries();
        verifyNoMoreInteractions(documentService);
    }

    @Test
    void nothingVisibleMeansNothingSuggested() {
        assertThat(service.suggest("calibration", 8)).isEmpty();
    }

    @Test
    void lessThanTwoCharactersSuggestsNothingAndSearchesNothing() {
        entry("SOP.0001", "Balance calibration");
        assertThat(service.suggest("c", 8)).isEmpty();
        assertThat(service.suggest(" ", 8)).isEmpty();
        assertThat(service.suggest(null, 8)).isEmpty();
        verifyNoMoreInteractions(documentService);
    }

    @Test
    void aNumberThatStartsWithTheTextComesFirstThenANameThatStartsWithItThenTheRest() {
        entry("WI.0100", "Cleaning of the balance");          // name contains "bal"
        entry("SOP.0002", "Balance calibration");             // name starts with "bal"
        entry("BAL.0003", "Weighing");                        // number starts with "bal"
        entry("SOP.0004", "Weighing in the lab");             // no match
        List<DocumentSuggestion> found = service.suggest("bal", 8);
        assertThat(found).extracting(DocumentSuggestion::documentNumber).containsExactly("BAL.0003", "SOP.0002", "WI.0100");
    }

    @Test
    void matchingIgnoresCaseAndSurroundingBlanks() {
        entry("SOP.0001", "Balance Calibration");
        assertThat(service.suggest("  CALIBRATION ", 8)).hasSize(1);
        assertThat(service.suggest("sop.00", 8)).hasSize(1);
    }

    @Test
    void theListIsLimitedAndNeverLongerThanTen() {
        for (int i = 0; i < 25; i++) {
            entry(String.format("SOP.%04d", i), "Procedure " + i);
        }
        assertThat(service.suggest("proc", 3)).hasSize(3);
        assertThat(service.suggest("proc", 500)).hasSize(KnowledgePortalService.MAX_SUGGESTIONS);
        assertThat(service.suggest("proc", 0)).hasSize(1);
    }

    @Test
    void aSuggestionCarriesWhatTheDropDownShows() {
        DocumentService.KnowledgeEntry entry = entry("SOP.0001", "Balance calibration");
        DocumentSuggestion suggestion = service.suggest("sop.0001", 8).get(0);
        assertThat(suggestion.id()).isEqualTo(entry.document().getId().toString());
        assertThat(suggestion.documentName()).isEqualTo("Balance calibration");
        assertThat(suggestion.revisionNumber()).isEqualTo("1.0");
        assertThat(suggestion.documentType()).isEqualTo("SOP");
        assertThat(suggestion.department()).isNull();
    }

    @Test
    void aDocumentWithNoNameOrNumberDoesNotBreakTheSearch() {
        entry(null, null);
        entry("SOP.0001", null);
        assertThat(service.suggest("sop", 8)).hasSize(1);
    }
}
