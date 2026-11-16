# Change record — action menus ready with the server page

Owner: project owner, 2026-11-14. Request: inspect and fix slow table action menus using the existing User Management fix as reference. Owner approved extending shared capability response contracts (HIGH/CRITICAL impact) with unchanged authorization and regression checks.

Scope: Access Profiles, Permission Sets, Controlled Copy batches and member-copy lists. Existing Report Templates, Uncontrolled Copies and User Management already consume row capabilities. Detail/editor pages may still query capabilities when their own object is loaded; that is not a table-menu click.

Invariants: the authenticated actor, view/object scope and action evaluators remain unchanged; capability is a display hint, never a grant. Mutation endpoints retain current permission, lifecycle, parent-document/revision, e-signature and audit checks. No change to status, artefact generation/version/checksum, delivery jobs or schema. Only the current authorized page receives capabilities; no browser-wide per-row request fanout. Missing/denied capability fails closed. Export adapters do not need action metadata.

Evidence boundary: docs/system and the one-change-record template are absent in this checkout. Source/tests provide As-Is evidence, not a GMP compliance claim. No new regulated workflow rule is invented.

Source-confirmed cause: AccessProfileListView and PermissionSetsView request per-row capabilities from their click handlers. ControlledCopiesView passes the open row ID into capability hooks; expanded child-copy rows do the same. PortalDropdownMenu animates the whole card for 120 ms and DropdownMenuItem has no stagger animation. UserManagementService includes row capabilities with its paged response and the UI uses those before its legacy fallback.

Impact: initial index (2026-10-31) reported shared FE AccessProfileResponse and PermissionSetResponse CRITICAL, 63 direct / 189 total references each; owner explicitly approved the scope. Existing getCapabilities methods each LOW/1 direct caller; listProfiles/listPaged overload candidates LOW. Index rebuild was started because current source has advanced. Final evidence and tests pending implementation.


## Implemented source

- AccessProfileResponse and PermissionSetResponse have additive optional capabilities; compatibility constructors retain previous detail/mutation call sites. Paged list responses use the exact same capability builders as dedicated endpoints. Actor-wide permissions are resolved once per page; Access Profile deletion uses the existing summary assigned-user count, and Permission Set assignment usage is counted in one grouped query for returned page IDs only. The existing system-set and assigned-set guards are unchanged.
- ControlledCopyController decorates only authorized HTTP list, batch and member pages through ControlledCopyMenuCapabilities; export/detail service adapters are not expanded. The original ControlledCopyAuthorizationService methods remain untouched. Multi-copy batch rows receive batch decisions, singleton rows receive their primary child-copy decisions. Denied/deleted/legacy capability results are null (no mutation action), not an allow fallback.
- AccessProfileListView, PermissionSetsView, ControlledCopiesView and expanded member menus use response capability data, without a request on click. Post-action reloads return current decisions. Existing explicit action-time checks and mutations retain their previous calls.
- Controlled Copy mapping carries capabilities without recomputing permissions in FE. Child cache is session-keyed, limited to 24 entries and 5 seconds; mutation invalidation removes pending entries. An invalidated older response cannot overwrite a newer decision or erase its in-flight request. These are display caches, never authorization grants.

## Impact/evidence limits

Index refreshed successfully: 50,177 nodes / 135,972 relationships / 300 flows. Refresh held the local graph DB lock while some per-symbol impact attempts ran; those returned UNKNOWN and are not evidence of LOW risk. Source call sites were checked while the additive helpers were prepared. Final exact impacts for listProfiles#11 and listPaged#15: CRITICAL, 3 direct callers each, roughly 1,397 reachable symbols / 59 indexed processes / 20 modules (broad transitive HTTP graph). This remains the owner-approved list-response scope. ControlledCopiesView LOW/0 direct; ExpandedControlledCopyRow LOW/1 direct; cache getter/preloader LOW/3 direct, invalidator MEDIUM/5 direct. Controller methods/Java records are not individually resolved by the index; source plus tests supply that boundary. GitNexus auto-updated AGENTS.md and CLAUDE.md symbol counts only.

## Test-confirmed

- 79 BE tests passed, 0 failures/errors/skips, across ActionMenuPageCapabilitiesTest (3), ControlledCopyMenuCapabilitiesTest (3), AccessProfileServiceSecurityTest (13), ControlledCopyControllerCapabilityTest (10), ControlledCopyAuthorizationServiceTest (6), DocumentAuthorizationServiceTest (38), TableExcelExportControllerTest (6).
- New BE tests compare paged Profile capabilities to the dedicated endpoint, revoke management permissions and requery, preserve system/usage denial, limit usage lookup to page IDs, route singleton/multi-copy targets correctly, preserve page metadata and fail closed for unavailable decisions.
- 16 FE tests passed across ExpandedCopyMenu.capabilities (5), DataTable.menuRender and SmartDropdown. New interactive menu tests assert allowed/denied/missing decisions without per-click capability requests; cache tests cover session separation, expiry and invalidated request races. jsdom emits its known scrollTo warning; tests pass.
- TypeScript noEmit passed in this checkout; no dependencies or schema migrations added.
- Tests use isolated target/table-export-validation build output to avoid modifying shared compiled artefacts. No business data is written by unit tests.

Owner confirmed concurrent Docker work is finished and authorized deployment. Backend/frontend containers were recreated successfully on 2026-11-14 around 13:41 Asia/Ho_Chi_Minh. Backend health is healthy; all seven deployed FE files match source bytes. Backend image f2d447a9e89f and frontend image 494a423ded37 were used. JPA startup did not report query-validation errors. Positive browser menu verification is pending: both the dedicated test tab and the existing owner tab reached Sign In after navigation/update, and the owner was asked to sign in again. No credentials were read, no commit/push performed.
