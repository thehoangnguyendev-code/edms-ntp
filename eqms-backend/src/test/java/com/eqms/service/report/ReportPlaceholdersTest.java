package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import org.junit.jupiter.api.Test;

class ReportPlaceholdersTest {
    @Test
    void theListIsTheSetOfCodesTheLayoutAccepts() {
        assertEquals(ReportLayout.TOKENS, new HashSet<>(ReportPlaceholders.ALL.stream().map(ReportPlaceholders.Item::code).toList()));
    }

    @Test
    @SuppressWarnings("unchecked")
    void aPageHoldsAtMostTenAndPagingSearchAndSortAreDoneHere() {
        var first = ReportPlaceholders.page(null, "name", "asc", 1, 500);
        assertEquals(10, ((List<?>) first.get("data")).size());
        var pagination = (Map<String, Object>) first.get("pagination");
        assertEquals(21, pagination.get("total"));
        assertEquals(3, pagination.get("totalPages"));
        var last = ReportPlaceholders.page(null, "name", "asc", 3, 10);
        assertEquals(1, ((List<?>) last.get("data")).size());
        var found = ReportPlaceholders.page("EXECUTOR", "code", "desc", 1, 10);
        var data = (List<Map<String, String>>) found.get("data");
        assertTrue(data.size() >= 3 && data.stream().allMatch(row -> (row.get("code") + row.get("name") + row.get("example")).toLowerCase().contains("executor")));
        assertTrue(data.get(0).get("code").compareTo(data.get(data.size() - 1).get("code")) > 0);
        assertEquals(1, ((Map<String, Object>) ReportPlaceholders.page("zzz-none", null, null, 9, 10).get("pagination")).get("page"));
    }
}
