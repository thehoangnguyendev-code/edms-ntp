# Superseded (2026-11-03)

`REPORT.md`, `results.json`, the pictures in `shots/` and the stage scripts `dv_run1.py` to `dv_run4.py` test the design of 2026-11-02, in which the
Department Head decided the record visibility of Document Control (a third Record Visibility mode, "Department rules", and a screen under Security &
Authorization). That design was replaced on 2026-11-03: the Department Head now shares the **Knowledge Base** from the Knowledge explorer, and Document
Control keeps its two Record Visibility options. See the Decision Log entries DEPT-VISIBILITY-2026-11-02 (superseded note) and KNOWLEDGE-SHARING-2026-11-03.

These files stay as the record of what was built and tested then. They cannot be run again: the API they call (`/security/department-visibility`) no
longer exists.

The current end-to-end script is `dv_run6.py` (scenarios K1-K18, including the administrator's Knowledge Shares list, "Check access" and removing a share on behalf of the Head). Run `dv_setup.py`, then `dv_run6.py`, then `dv_restore.py`, with the environment
variable `DEVPW` set. At the time of writing it had NOT been executed.
