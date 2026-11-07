# Change record: manual Document Number and Training Number (2026-11-03)

Decision: `MANUAL-NUMBERING-2026-11-03` in `docs/governance/DECISION_LOG.md`.

## Invariant affected
Identity of a controlled Document (its number) and of a Training activity: uniqueness (unique indexes), who may type or change it, the lifecycle point after which it is
frozen (a stored source file / an opened training), a reason and an Audit Trail entry for every change, and the server as the only authority (the screen check is a hint).

## Change
| Area | Change |
|---|---|
| Settings | `documents.documentNumberEntryMode` (Document Properties) and `training_settings.training_number_entry_mode` (Training Properties, V732), AUTO default, MANUAL; both radio buttons |
| Document Number | `DocumentNumberService` (rule, duplicate check, state, change); `DocumentService.applyDraftFields` takes `manualDocumentNumber`; API `GET /documents/number/check`, `GET /documents/{id}/number-state`, `PUT /documents/{id}/number` |
| Training Number | `TrainingNumberService.check/useTyped`; `TrainingDocumentIntegrationService` (typed number in the document save, `numberState`, `changeNumber`); API `GET /training/numbers/check`, `GET/PUT /training/numbers/activities/{id}` |
| Request | `DocumentDraftCreateRequest.manualDocumentNumber`, `manualTrainingNumber` (old 28-argument constructor kept) |
| UI | Document Properties (two selects), `ManualNumberField` (live check, suggestion, change with a reason), General tab, Training tab, save guard in New Document |

## Evidence
- Unit tests: `DocumentNumberServiceTest` (10), `TrainingNumberCheckTest` (5); frontend `ManualNumberField.test.tsx` (5); frontend suite 1269 of 1269, `tsc` clean.
- Live API on DEV as DCO with both modes MANUAL (config restored to the original afterwards): no number refused; duplicate (also a cancelled Document's number) refused with the owner's name; wrong digits refused; a valid lower-case number saved as upper case; change without a reason refused; change to a used number refused; change accepted with a reason and audited (CREATE and DOCUMENT_NUMBER_CHANGED rows); AUTO refuses a typed number; Training Number: right department/year ok, wrong department refused, other year warned, wrong shape refused.
- Browser: New Document shows the Document Number box, disabled with "Choose the Document Type first" until the type is chosen.

## Not covered
Typing a Training Number through a full save in the browser; the lock after a source file is stored (unit-tested, not driven end to end); two people typing the same number at the same moment (the unique index is the guard, no dedicated test); Legacy Import (unchanged).
