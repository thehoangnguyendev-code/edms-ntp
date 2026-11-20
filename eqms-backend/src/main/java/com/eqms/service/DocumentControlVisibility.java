package com.eqms.service;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * How much of Document Control an Access Profile lets its people see (DC-VISIBILITY-TIERS-2026-11-07, VISIBILITY-TIERS-2026-11-20). Computed from
 * the permissions the profile grants, never stored, so it cannot drift from what the profile really does.
 *
 * <ul>
 *   <li>{@link #VIEW_EVERYTHING}: all three view-all permissions (Documents and Revisions, Controlled Copies, Uncontrolled Copies).</li>
 *   <li>{@link #INCOMPLETE}: one or two of them. Each still works alone, but the profile sees everything of one kind and only its own of another.</li>
 *   <li>{@link #DEPARTMENT}: none of the view-all permissions, but the department level: the Documents and Revisions of the person's own
 *       Department, and (as in the default) what has their name, including the copies of the revisions where they are named.</li>
 *   <li>{@link #NAMED_IN_FLOW}: none of them; a person sees exactly what has their name (the default).</li>
 * </ul>
 * The values are stable machine codes; a screen translates them for display only.
 */
public final class DocumentControlVisibility {

    public static final String VIEW_EVERYTHING = "VIEW_EVERYTHING";
    public static final String INCOMPLETE = "INCOMPLETE";
    public static final String NAMED_IN_FLOW = "NAMED_IN_FLOW";
    public static final String DEPARTMENT = "DEPARTMENT";

    /** The three permissions of the view-everything bundle. */
    public static final List<String> VIEW_ALL_PERMISSIONS = List.of(
            DocumentAuthorizationService.PERMISSION_DOCUMENT_VIEW_ALL,
            DocumentAuthorizationService.PERMISSION_CONTROLLED_COPY_VIEW_ALL,
            DocumentAuthorizationService.PERMISSION_UNCONTROLLED_COPY_VIEW_ALL);

    private DocumentControlVisibility() {
    }

    /**
     * The visibility an Access Profile shows: null when it holds no Document Control permission at all (the choice exists only for a profile that holds a permission of the module),
     * otherwise {@link #classify}.
     */
    public static String ofProfile(Collection<String> permissionCodes) {
        boolean holdsDocumentControl = permissionCodes != null && permissionCodes.stream()
                .anyMatch(code -> code != null && code.trim().toLowerCase(Locale.ROOT).startsWith("documents."));
        return holdsDocumentControl ? classify(permissionCodes) : null;
    }

    public static String classify(Collection<String> permissionCodes) {
        if (permissionCodes == null || permissionCodes.isEmpty()) {
            return NAMED_IN_FLOW;
        }
        Set<String> granted = permissionCodes.stream()
                .filter(code -> code != null)
                .map(code -> code.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        long held = VIEW_ALL_PERMISSIONS.stream().filter(granted::contains).count();
        if (held == 0) {
            return granted.contains(DocumentAuthorizationService.PERMISSION_DOCUMENT_VIEW_DEPARTMENT) ? DEPARTMENT : NAMED_IN_FLOW;
        }
        return held == VIEW_ALL_PERMISSIONS.size() ? VIEW_EVERYTHING : INCOMPLETE;
    }
}
