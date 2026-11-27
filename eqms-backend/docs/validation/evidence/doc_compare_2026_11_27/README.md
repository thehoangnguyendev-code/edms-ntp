Evidence for DEC-DOC-2026-11-27-01/02. Run on 2026-11-27 on an isolated stack: backend :5100 on a clone of the DEV database, a throw-away MinIO, the DEV OnlyOffice 9.4.0.1, frontend :3113. All of it was removed afterwards.

- `e2e.py <folder>`: 36 API checks, 36 passed. `conc.py <folder>`: two creations at once leave one draft.
- The scripts expect `pw.txt` (a throw-away password of the clone) and a `spike/` folder with `old.docx`, `new.docx` and `http_result.docx` (here `tracked.docx`).
- `pdf_with_tracked_changes.png`: PDF converted from a file that still holds tracked changes.
- `ui_*.png`: compare dialog, reviewer screen with the warning, Upload Revision dialog.

Second run (DEC-DOC-2026-11-27-04): `e2e_clean.py <folder>`, 15 of 15 passed (needs `real/marked.docx`, here `marked_by_onlyoffice.docx`). `publishing_preview_clean.png`: the PDF of that marked revision with the SOP template. `ui_reviewer_markup.png`: the reviewer's viewer of the same file. `pdf_with_tracked_changes.png` above shows the behaviour BEFORE this change.
