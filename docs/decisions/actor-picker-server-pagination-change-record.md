# Change Record — Actor Picker Server Pagination

Status: **IMPLEMENTED** · Scope: read-only actor lookup used by Authorization Engine Diagnostics

## Problem

The initial Actor picker loaded every active user through `GET /metadata/users` and filtered,
sorted, and paginated the list in the browser. This does not scale for a high-cardinality user
directory and can expose an unnecessarily large response to the client.

## Invariant

- The picker remains a read-only lookup of Active users. It only supplies `subjectUserId` to the
  simulator; `POST /authorization/evaluate` remains the server-side authorization boundary and
  does not execute the simulated action.
- No lifecycle state, parent/child state, artefact version/checksum, async job, audit record, or
  electronic signature is created or changed by this lookup.
- Existing `GET /metadata/users` behavior is retained for existing callers. The new
  `GET /metadata/users/paged` contract performs search, department filtering, whitelisted
  sorting, and pagination on the server; page size is capped at 100.

## Evidence

- Source: `MetadataController.getUsersLookupPaged` queries Active users through
  `UserAccountRepository.findParticipantCandidates`, maps only the requested page, and batches
  access-profile lookups for that page.
- Source: `ActorPickerModal` sends query, sort, page, and limit to the paged endpoint and renders
  only the received page.
- Regression: `MetadataControllerTest` covers query normalization, department filtering,
  page-size cap, server sort, and unknown-sort fallback.
