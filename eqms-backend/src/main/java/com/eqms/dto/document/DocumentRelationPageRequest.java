package com.eqms.dto.document;

import java.util.List;

/**
 * Paging request for the Related / Correlated Documents tabs. The tab lists the (possibly not yet saved) selection the
 * user is editing for the next revision, so the ids come from the client while the search, sort, paging and the per-user
 * visibility check are all done by the server.
 */
public record DocumentRelationPageRequest(
        List<String> ids,
        String relationType,
        String search,
        String sortBy,
        String sortDirection,
        Integer page,
        Integer limit
) {
}
