# Network policy shared configuration save — 2026-10-28

Request: increase both CIDR textareas, disable resizing, allow internal scrolling, place the emergency-account explanation directly below its select, and replace the panel Save Network Policy action with Configuration's Save Changes.

## Scope and invariants

Frontend only: ConfigurationView, NetworkAccessPanel, and useNetworkAccessDraft. The existing settings/network-access GET, PUT and check-address endpoints remain in use. Permission checks, network enforcement, CIDR/proxy validation, emergency-account protection, database persistence and transactional before/after audit are unchanged on the server. No lifecycle, signature, artifact version or asynchronous generation behavior changes.

The network draft lives at page level and survives changing tabs. Reset discards it. Saving only changed sections avoids rewriting unchanged policy. System settings are saved first and network policy last because network enforcement takes effect immediately. These are separate server transactions: a failed network save after a successful settings save is explicitly reported and the network draft remains available for correction/retry. A failed settings save prevents the policy request. Duplicate confirmation is guarded while saving.

## Evidence

- GitNexus: ConfigurationView and saveConfiguration/reset LOW; renderTabContent has one direct caller and zero affected processes. NetworkAccessPanel was missing from the old index. Index refresh was attempted but failed with an inconsistent file_fts index; its computed impact remains unavailable. Direct source inspection finds ConfigurationView as its production caller.
- Component tests cover address-check normalization without saving; recovery explanation; fixed-height scrolling fields; removal of the standalone save; nearby emergency-account explanation.
- Configuration integration tests cover network-only save, settings-only save, draft persistence across tabs, Reset, rejected network save after successful settings save and retry, and refusing to apply the policy after a settings-save failure.
- Focused configuration, network-panel and session-timeout tests: 11 tests passed. TypeScript check passed.
- No live network policy is changed for verification. This record does not assert GMP compliance or atomicity across the two existing endpoints.
