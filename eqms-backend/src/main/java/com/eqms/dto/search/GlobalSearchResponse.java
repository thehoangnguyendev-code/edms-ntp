package com.eqms.dto.search;

import java.util.List;

/**
 * The answer of the global search: groups of results, each group one kind of record the person may open. A group is there only when the person
 * can reach that kind of record at all; {@code unavailable} means the group could not be searched this time (timeout or failure), not that it is empty.
 */
public record GlobalSearchResponse(String query, List<Group> groups) {

    public record Group(String key, String label, List<Item> items, long total, boolean unavailable) {
    }

    /**
     * One result. {@code id} is what the screen needs to open the record; {@code code} is the number a person quotes for it (document number, training number,
     * employee code...), shown first; {@code path} is set for a page of the menu, for the list screen of a kind that has no screen per record, and for a
     * notification. Nothing here is personal data beyond what the list screen of the same record shows.
     */
    public record Item(String id, String code, String title, String subtitle, String badge, String path) {
    }
}
