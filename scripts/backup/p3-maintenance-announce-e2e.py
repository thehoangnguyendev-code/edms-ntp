"""Maintenance notice to everyone (System Announcements) and sign-out of open sessions when the window drains, on the DEV stack.
Passwords come from the environment only. Needs the 1-minute DEV notice (AGENT_MAINTENANCE_NOTICE_MIN_MINUTES=1)."""
import json
import os
import subprocess
import sys
import time

ADMIN_PW = os.environ["ADMIN_PW"]
REQ = "RQ-ANN-" + str(int(time.time()))  # unique per run: the ledger keeps every run
SA_PW = os.environ["SA_PW"]
API = "http://localhost:5000/api"
results = []


def curl(method, path, token=None, body=None, headers=None):
    cmd = ["docker", "exec", "-i", "eqms-backend", "curl", "-s", "-w", "\n%{http_code}", "-X", method]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    for k, v in (headers or {}).items():
        cmd += ["-H", f"{k}: {v}"]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    cmd.append(API + path)
    out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8").stdout
    text, _, status = out.rpartition("\n")
    try:
        data = json.loads(text) if text.strip() else {}
    except json.JSONDecodeError:
        data = {"raw": text[:200]}
    return int(status or 0), data


def psql(sql):
    out = subprocess.run(["docker", "exec", "-i", "eqms-postgres", "psql", "-U", "eqms", "-d", "eqms-database", "-Atc", sql],
                         capture_output=True, text=True)
    return out.stdout.strip()


def ledger(sql):
    out = subprocess.run(["docker", "exec", "-i", "eqms-backup-control", "psql", "-U", "eqms_backup", "-d", "eqms_backup_control", "-Atc", sql],
                         capture_output=True, text=True)
    return out.stdout.strip()


def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))


def admin_login():
    s, d = curl("POST", "/auth/login", body={"identifier": "admin", "password": ADMIN_PW})
    return d.get("accessToken") if s == 200 else None


def active_announcements(token):
    s, d = curl("GET", "/announcements/active", token)
    return d if isinstance(d, list) else d.get("data", []) if isinstance(d, dict) else []


# preconditions: the system is open
s, st = curl("GET", "/system/maintenance-status")
if st.get("state") != "NORMAL":
    print("the system must be NORMAL first:", st)
    sys.exit(2)

token = admin_login()
check("admin signs in", token is not None)
open_before = int(psql("select count(*) from auth_sessions where revoked_at is null") or 0)
check("there are open sessions to sign out", open_before >= 1, str(open_before))

# 1. start the notice: a critical announcement goes to everyone
s, login = curl("POST", "/system/maintenance/login", body={"username": "super.admin", "password": SA_PW})
PASS = login.get("pass")
s, n = curl("POST", "/system/maintenance/notice", headers={"X-Maintenance-Pass": PASS}, body={"minutes": 1, "requestId": REQ})
check("the notice starts", s == 200 and n.get("state") == "NOTICE", str(s))
time.sleep(2)
anns = active_announcements(token)
mine = [a for a in anns if f"[{REQ}]" in (a.get("title") or "")]
check("everyone sees the maintenance announcement", len(mine) == 1, str([a.get("title") for a in anns][:3]))
check("the announcement is critical", bool(mine) and str(mine[0].get("severity", "")).upper() == "CRITICAL", str(mine[0].get("severity") if mine else ""))

# 2. the notice runs out: open sessions are revoked and recorded in the ledger
print("      waiting for the notice to run out ...")
state = None
for _ in range(60):
    time.sleep(5)
    s, st = curl("GET", "/system/maintenance-status")
    state = st.get("state")
    if state == "DRAINED":
        break
check("the window drains", state == "DRAINED", str(state))
open_after = open_before
for _ in range(12):  # the sign-out runs on its own schedule (every 5 seconds): wait for it, up to a minute
    open_after = int(psql("select count(*) from auth_sessions where revoked_at is null") or 0)
    if open_after == 0:
        break
    time.sleep(5)
check("every open session is revoked", open_after == 0, f"{open_before} -> {open_after}")
recorded = ledger(f"select count(*) from ledger_event where event = 'MAINTENANCE_SESSIONS_REVOKED' and ref = '{REQ}'")
check("the sign-out is recorded in the ledger", recorded == "1", recorded)
detail = ledger(f"select data_json from ledger_event where event = 'MAINTENANCE_SESSIONS_REVOKED' and ref = '{REQ}' order by seq desc limit 1")
check("the ledger says how many sessions were signed out", '"sessionsRevoked"' in detail, detail[:120])

# 3. back to normal: the notice is switched off and the system-open notice is published
s, ul = curl("POST", "/system/maintenance/cancel", headers={"X-Maintenance-Pass": PASS})
check("the window is closed", s == 200 and ul.get("state") == "NORMAL", str(s))
time.sleep(2)
token2 = admin_login()
anns2 = active_announcements(token2) if token2 else []
still = [a for a in anns2 if f"[{REQ}]" in (a.get("title") or "") and "System maintenance" in (a.get("title") or "")]
check("the maintenance notice is switched off after the window", len(still) == 0)

passed = sum(1 for _, ok in results if ok)
print(f"\nRESULT: {passed} of {len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
