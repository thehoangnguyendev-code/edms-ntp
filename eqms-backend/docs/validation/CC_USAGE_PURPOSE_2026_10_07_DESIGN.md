# Controlled copy usage purpose: read-and-comply vs record-keeping (technical design, 2026-10-07)

Status: DESIGN, decisions taken by the owner (see CC-PURPOSE-2026-10-07 in the Decision Log). **Nothing is built.** Customer-facing plan:
docs/plans/KE_HOACH_MUC_DICH_SU_DUNG_BAN_SAO_KIEM_SOAT.md. This earlier text proposed a destruction round and a one-time classification of old copies; the owner
declined both, so they are not part of the design.

## Rules
- `usage_purpose` on controlled copies and on distribution batches. Machine values `READ_AND_COMPLY` and `RECORD_KEEPING`; NULL only for copies issued before the change
  (nothing is back-filled, nothing classifies them). Labels are display text only and are never used for logic, permissions or policy. The request field is named
  `usagePurpose`: the existing `purpose` is only the reason text.
- Required on a new request, exactly one of the two values, no preselected value; the server refuses a missing or unknown value. All copies of a request carry the
  same value; a Lost/Damaged replacement inherits its original's. Fixed after issue (no edit); a wrong choice is corrected by recalling (or cancelling the request
  if not distributed) and requesting again.

## Screens
- **Request** (`RequestControlledCopyView`): two radio options, one required choice, none preselected; Submit disabled until chosen; shown in the signature summary.
- **Controlled Copies list** and **batch list**: a Purpose column (server-side sort, Custom Column) and a Purpose filter (standard, compact and mobile), also on the
  export if there is one; old rows show a dash and appear under "All" only.
- **Detail** (copy and batch): a Purpose field on the Document Information tab.
- **Controlled Copies sub-tabs** of the document detail and of document creation: a Purpose column.
- **Audit trail**: the request entry and each created copy record `usagePurpose`.

## Recall
- `RECORD_KEEPING`: unchanged (recall by scan or one by one; the scan becomes a Record).
- `READ_AND_COMPLY`: recalled without a scan with the existing recall (Recall Date, reason, signature). In Recall by Scan the review row says "recalled, no Record
  will be made"; on commit the copy is recalled normally and **no Record is created**; the audit entry says so. A batch may mix both purposes.
- **Records** (menu and tab, list and CSV if any): no Record of a `READ_AND_COMPLY` copy is listed. Records of copies with `RECORD_KEEPING` or with no purpose (issued
  before) are listed as today.

## Not enforceable by the system (stays procedure)
Blue ink, striking out unused boxes, signing corrections, the hand stamps, the ban on photocopying, the physical keeping and the destruction of recalled paper.

## Evidence to produce when built
Request refused without a purpose or with another value, and only one value accepted; the purpose copied to every copy and to a replacement; recall of a read copy
without a scan; recall by scan of a read copy recalls it, creates no Record and says so before signing; a mixed batch; Records excluding read copies and still
showing old and record-keeping ones; Purpose column, sort and filter on every list and sub-tab, detail field; audit entry on request; old rows untouched by the
migration; the purpose not editable after issue.
