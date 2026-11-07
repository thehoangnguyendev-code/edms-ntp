# OnlyOffice Preview settings, image watermark time zone and Uncontrolled Copy number — 2026-11-02

Three small changes of the same day, each with its owner decision in `DECISION_LOG.md` (OO-PREVIEW-SETTINGS-2026-11-02, IMAGE-WATERMARK-TZ-2026-11-02, UCC-NUMBER-2026-11-02).

## 1. OnlyOffice Preview (Settings > Configuration > Preview File)

- **Mode of a stage:** Pending Review and Pending Approval can each be Review Mode (track changes) or Comment Only. Until set: Pending Review = Review, Pending Approval = Comment Only (as before). Draft stays Edit for the author. Who may open the file at a stage is unchanged (`getOnlyOfficeEditConfig` still checks the workflow action). Stored in `general.backupSettings.onlyOffice.viewer.pendingReviewMode` / `pendingApprovalMode`.
- **Watermark in View Mode:** the same settings as the PDF "Watermark and Traceability" (switch, text, strength, colour, angle, viewer code, viewer name, time opened, grid), kept under the same names in `viewer.watermark*`. One shared editor (`WatermarkTraceabilityEditor`) for both previews. The server builds the mark at each opening from the signed-in user and the server clock (`OnlyOfficeViewWatermark`) and puts it in `document.options.watermark_on_draw`; the Document Server draws it on every page. It applies to the read-only viewer of revisions and of stored training files; the editors (Edit, Review, Comment Only) get none, and the stored file is not changed.
- **How it is drawn (revised the same day):** the first version filled one mark with repeated text and the editor wrapped the rows unevenly, unlike the sample of the Configuration screen. The server now draws the PDF watermark itself, with the same block (the text, the viewer line, the time), the same angle about its centre and the same lattice for the grid, into a transparent 8-bit PNG, and the Document Server shows that picture on every page (`watermark_on_draw.fill`, the strength as its opacity). The picture is a frame of 300 x 300 mm centred on the page, so A4 and Letter in either direction lie inside it (A3 and larger are not covered); the editor clips it to the page. A grid weighs about 150 KB inside the signed configuration of the editor. Font: the PDF watermark is Helvetica Bold, so the picture is drawn with Liberation Sans Bold (same letter widths as Helvetica and Arial); `fonts-liberation` was added to the backend Dockerfile (DejaVu Sans, wider, is only a last resort). The picture is made at 2.5 pixels for each point, in a frame of 850 x 850 pt, so the text stays sharp on a dense screen or at 150% zoom.
- **Checked on the Document Server of DEV** (a Word file opened in View Mode with the JSON that the backend generated, screenshots): the single mark and the grid at 28 degrees appear with the blocks as in the sample, with the colour and the opacity of the strength.
- **Not checked:** the pages after the first of a long file; a file with a landscape page; the watermark inside the real revision tab behind the login; the mode change end to end with a real reviewer and approver.

## 2. Image watermark: time zone of the upload time

`imageWatermark.<target>.utcOffset` ("+07:00" by default; -12:00 to +14:00, minutes 00, 30 or 45) for Controlled Copy Destruction Evidence and for Specimen Signature. The stamp prints `02/11/2026 11:20:43 (UTC+7)`; the preview of the Configuration screen and of the upload forms are made by the same code. The position is chosen in a Select. Pictures already stamped keep what they carry.

## 3. Uncontrolled Copy number

`UCC.<document number>.<serial>` (UCC.SOP.0007.001), made like a Controlled Copy number (`CC.SOP.0007.001`) with a U in front, by one class for both (`CopyNumberFormat`). A copy numbered before this change keeps its number (UC-SOP.0007-001); nothing was renumbered. The serial is still counted per document, and a number that exists is skipped.

## Verification and limitations

Unit tests: `OnlyOfficeViewerSettingsTest` (12), `ImageWatermarkServiceTest` (15), `CopyNumberFormatTest` (3), `PreviewFileTab` (11 with the angle), `ImageWatermarkTab`, `uncontrolledCopyBaseCode`; `tsc`; the 6 Spring integration test classes could not start here (no connection to the database from the host), the same as before this change.
GitNexus was not available: no `impact` / `detect_changes`. Callers found by search.
Rollback: revert the code; the stored settings are ignored by the old application. Copies numbered UCC.* stay valid records.
