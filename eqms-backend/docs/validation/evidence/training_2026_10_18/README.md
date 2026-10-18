# Training API walkthrough scripts (DEV, 2026-10-18)

Python scripts that drove the Training backend through its real HTTP API on DEV with the test accounts admin, approver.test1, user.a.test and dco.test1. They are the evidence for
`TRAINING_PAPER_BATCH_2026_10_18_CHANGE_RECORD.md`. The password is read from the environment variable `DEVPW` and is never stored. `api.py` is the small client (login, e-signature token,
JSON and multipart calls). Run them in order from this folder, for example `DEVPW=... python e2e1_create_session_prepare.py`; each script writes `e2e_state.json` for the next one.
They create real DEV records (activities, a batch export, a copy log row, a specimen signature); they are not meant for another environment.
