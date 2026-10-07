# Publishing: parent-document footer line (2026-10-07)

Decision: PUBLISHING-PARENT-FOOTER-2026-10-07 in `../governance/DECISION_LOG.md`.

- `ParentDocumentResolver`: parent of a document = the document listing it with relation type RELATED
  (`DocumentRelationRepository.findAllByTargetDocument_IdAndRelationType`); several parents resolve to the lowest document number.
- `PublishingTemplatePlaceholderMapperService`: `{{parentDocumentLine}}` (the footer sentence), `{{parentDocumentName}}`,
  `{{parentDocumentNumber}}`; empty when there is no parent. Listed in the placeholder catalog, group "Footer and Cover Notes".
- Applies wherever the publishing template is rendered: published PDF/DOCX of a revision. The value is resolved at render time, so it
  is frozen into the published file; it changes only when the revision is published or refreshed again.
- Tests: `ParentDocumentFooterTest` (5): parent number and name, exact sentence, no revision number, no parent prints nothing, only
  RELATED is asked for, deterministic choice among several, missing/malformed id. Existing publishing and report-word tests pass.
- Not done: no template has been edited to use the placeholder (a template owner must add `{{parentDocumentLine}}` to the footer
  of the DOCX); not tried with a real template and the Microsoft Graph conversion; the controlled copy flow re-renders through the
  same service, so a copy composed later shows the parent as it is then. GitNexus impact / `detect_changes` were not run (tool not
  available in this session; nothing committed).
