# OnlyOffice Community preview settings -- change record

Status: IMPLEMENTED, pending QA review.

## Requested change

Make **Settings > Configuration > Preview File > OnlyOffice preview** truthful for the deployed
`onlyoffice/documentserver:8.2` Community Edition. Do not present controls that the deployed
Document Server cannot apply.

## Source-confirmed as-is finding

The viewer used the `editorConfig.customization.layout` object to configure File, View, Plugins,
left-panel, right-panel and status-bar visibility. The bundled Docker image is
`onlyoffice/documentserver:8.2`. OnlyOffice documents `layout` as an extended White Label
customization, not a Community Edition capability. The Community server silently ignores the
unsupported fields, so a disabled File tab could remain visible.

## Implemented design and invariant

- The configuration UI exposes only Community-supported settings: enable plugins, initial
  right-menu state, and document-name visibility.
- The generated read-only viewer config sends only `plugins`, `hideRightMenu`,
  `toolbarHideFileName`, and `compactHeader`. No White Label `layout`, `leftMenu`, or
  `statusBar` fields are sent.
- Hiding the document name explicitly enables the compact header because OnlyOffice requires it
  for `toolbarHideFileName` to take effect.
- Existing persisted unsupported JSON fields are ignored for backward compatibility; no
  configuration data or document artefact is deleted or migrated.
- Actor/permission/object scope, revision lifecycle, parent-child effects, source-file version and
  checksum, electronic signatures, audit records, and asynchronous processing are unchanged.
  The configuration is consumed only when an already-authorized read-only viewer session is built.

## Evidence

- `OnlyOfficeDocumentEditServiceTest#buildViewerConfigUsesOnlyCommunityEditionCustomizations`
  verifies read-only permissions remain denied and verifies the generated config includes only
  Community-supported customization fields.
- Manual QA: save each setting, close/reopen a Document tab in a fresh browser profile, and verify
  plugins, right-menu initial state, and compact-header filename behavior. The right-menu setting
  may be overridden by OnlyOffice's per-browser local preference.

## Residual risk / QA decision

This change intentionally removes unsupported White Label presentation controls. If the business
later acquires an OnlyOffice Developer White Label license, a separately approved change record
must reintroduce capability-gated tab/panel controls and validate against that licensed server.

## PDF preview policy

The PDF preview policy now has one watermark renderer: the authorized revision-preview endpoint.
The browser no longer draws a second watermark layer. The endpoint reads `enableWatermark` and
`pdfPreview` from the same persisted document-policy object, and may include the authenticated
viewer name and server-generated opened time. The output is transient response content only; it
does not replace the source/published PDF, alter MinIO content or checksum, or expose those
values in SSE. Controlled Copy and Knowledge preview surfaces continue to use their distinct,
recipient/session-specific policies.

An open Document tab re-fetches its authorized preview response when the committed
`documents-preview-config-updated` event arrives, so the new policy appears without a browser
page reload while preserving the current revision and workflow UI state.

## Realtime application (Phase 2)

After the System Configuration transaction and its existing audit entry commit, the backend emits
the non-sensitive SSE invalidation `onlyoffice-viewer-config-updated` only when the persisted
`backupSettings.onlyOffice.viewer` object changes. Open read-only viewers subscribe to that event,
destroy their current iframe and request a fresh signed viewer config. This does not alter the
viewer actor, authorization, document revision, source file, lifecycle, e-signature, audit trail,
or asynchronous work. A test verifies an unrelated General setting does not emit this invalidation
condition, while a viewer setting does.
