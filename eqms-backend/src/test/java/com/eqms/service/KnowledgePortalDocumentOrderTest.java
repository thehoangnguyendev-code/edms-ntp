package com.eqms.service;

import com.eqms.dto.document.KnowledgeBaseDocumentResponse;
import com.eqms.dto.knowledge.KnowledgePortalDtos.PortalDocument;
import com.eqms.service.KnowledgePortalService.SortRow;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class KnowledgePortalDocumentOrderTest {

    private static SortRow row(String number, String name, long views, Long size, String lastOpened) {
        KnowledgeBaseDocumentResponse document = new KnowledgeBaseDocumentResponse(
                number, number, name, "1", null, null, "SOP", null, "QA", null, null, null, null, false, false, false);
        return new SortRow(null, new PortalDocument(document, views, 0, false, null, size, lastOpened));
    }

    private static List<String> order(List<SortRow> rows, String by, String direction) {
        return rows.stream().sorted(KnowledgePortalService.documentOrder(by, direction)).map(r -> r.doc().document().documentNumber()).toList();
    }

    private final List<SortRow> rows = List.of(
            row("A", "Alpha", 5, 300L, "2026-10-05T10:00:00Z"),
            row("B", "Bravo", 9, null, null),
            row("C", "Charlie", 1, 100L, "2026-10-07T10:00:00Z"));

    @Test
    void nameIsTheDefaultAndAnUnknownKeyFallsBackToIt() {
        assertThat(order(rows, "name", "asc")).containsExactly("A", "B", "C");
        assertThat(order(rows, "nonsense", "asc")).containsExactly("A", "B", "C");
        assertThat(order(rows, null, null)).containsExactly("A", "B", "C");
        assertThat(order(rows, "name", "desc")).containsExactly("C", "B", "A");
    }

    @Test
    void sizeSortsADocumentWithoutARecordedSizeAsTheSmallest() {
        assertThat(order(rows, "size", "asc")).containsExactly("B", "C", "A");
        assertThat(order(rows, "size", "desc")).containsExactly("A", "C", "B");
    }

    @Test
    void lastOpenedSortsANeverOpenedDocumentAsTheOldest() {
        assertThat(order(rows, "lastOpened", "desc")).containsExactly("C", "A", "B");
        assertThat(order(rows, "lastOpened", "asc")).containsExactly("B", "A", "C");
    }

    @Test
    void equalValuesKeepAStableOrderByNameSoPagesDoNotRepeatOrSkipRows() {
        List<SortRow> same = List.of(row("Z", "Zulu", 4, 1L, null), row("Y", "Yankee", 4, 1L, null), row("X", "X-ray", 4, 1L, null));
        assertThat(order(same, "views", "desc")).containsExactly("X", "Y", "Z");
        assertThat(order(same, "views", "asc")).containsExactly("X", "Y", "Z");
    }
}
