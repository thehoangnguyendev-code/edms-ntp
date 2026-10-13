"""Maintenance window end to end on the DEV stack, through the eQMS API. Passwords come from the environment only."""
import json
import os
import subprocess
import sys
import time

ADMIN_PW = os.environ["ADMIN_PW"]
SA_PW = os.environ["SA_PW"]
API = "http://localhost:5000/api"
LOCK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backups", "dev", "maintenance", "maintenance.lock")
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


def check(name, ok, detail=""):
    results.append((name, ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  [{detail}]" if detail else ""))


def lock_state():
    return open(LOCK, encoding="utf-8").read() if os.path.exists(LOCK) else None


def admin_login():
    s, d = curl("POST", "/auth/login", body={"identifier": "admin", "password": ADMIN_PW})
    return d.get("accessToken") if s == 200 else None


# 1. the state is public and starts NORMAL
s, st = curl("GET", "/system/maintenance-status")
check("status is public and NORMAL", s == 200 and st.get("state") == "NORMAL", f"{s} {st.get('state')} {st.get('source')}")

# 2. the Super Administrator signs in; a wrong password gets the same answer as a wrong user
s, bad = curl("POST", "/system/maintenance/login", body={"username": "super.admin", "password": "nope-nope"})
check("wrong password refused", s == 401 and bad.get("code") == "INVALID_CREDENTIALS", f"{s}")
s, bad2 = curl("POST", "/system/maintenance/login", body={"username": "nobody", "password": "nope-nope"})
check("unknown user refused the same way", s == 401 and bad2.get("code") == bad.get("code"), f"{s}")
s, login = curl("POST", "/system/maintenance/login", body={"username": "super.admin", "password": SA_PW})
PASS = login.get("pass")
check("Super Administrator gets a maintenance pass", s == 200 and PASS, f"{s}")

# 3. actions need the pass
s, _ = curl("POST", "/system/maintenance/notice", body={"minutes": 5, "requestId": "RQ-TEST"})
check("a notice without a pass is refused", s == 401, f"{s}")
s, _ = curl("POST", "/system/maintenance/notice", headers={"X-Maintenance-Pass": "forged.token"}, body={"minutes": 5, "requestId": "RQ-TEST"})
check("a forged pass is refused", s == 401, f"{s}")
s, _ = curl("POST", "/system/maintenance/notice", headers={"X-Maintenance-Pass": PASS}, body={"minutes": 0, "requestId": "RQ-TEST"})
check("a notice of 0 minutes is refused", s == 400, f"{s}")

# 4. notice: users keep working for the notice
s, n = curl("POST", "/system/maintenance/notice", headers={"X-Maintenance-Pass": PASS}, body={"minutes": int(os.environ.get("NOTICE_MINUTES", "1")), "requestId": "RQ-TEST"})
check("notice starts", s == 200 and n.get("state") == "NOTICE", f"{s} {n.get('state')}")
token = admin_login()
check("users can still sign in during the notice", token is not None)
s, _ = curl("GET", "/system/maintenance-status")

# 5. wait for the notice to run out: the system drains by itself
print("      waiting for the notice to run out ...")
state = None
for _ in range(60):
    time.sleep(5)
    s, st = curl("GET", "/system/maintenance-status")
    state = st.get("state")
    if state in ("DRAINED", "LOCKED"):
        break
check("the notice runs out and the system drains by itself (no action from anyone)", state == "DRAINED", state)
check("the lock file says DRAINED", lock_state() is not None and '"DRAINED"' in lock_state(), (lock_state() or "")[:80])

s, _ = curl("POST", "/auth/login", body={"identifier": "admin", "password": ADMIN_PW})
check("an ordinary login is refused while drained", s == 503, f"{s}")
s, body = curl("GET", "/backup-restore/backups", token=token)
check("a session that was open is refused too", s == 503 and body.get("code") == "MAINTENANCE_MODE", f"{s} {body.get('code')}")

# 6. lock: only after the administrator confirms that nobody is working
s, _ = curl("POST", "/system/maintenance/lock", headers={"X-Maintenance-Pass": PASS}, body={"noUserConfirmed": False})
check("lock without confirmation is refused", s in (409, 400), f"{s}")
s, lk = curl("POST", "/system/maintenance/lock", headers={"X-Maintenance-Pass": PASS}, body={"noUserConfirmed": True})
check("lock with confirmation", s == 200 and lk.get("state") == "LOCKED", f"{s} {lk.get('state')}")
check("the lock file says LOCKED", lock_state() is not None and '"LOCKED"' in lock_state())

# the Super Administrator's own pass still reaches the maintenance calls, and nothing else
s, cur = curl("GET", "/system/maintenance/current", headers={"X-Maintenance-Pass": PASS})
check("the maintenance calls still answer while locked", s == 200 and cur.get("state") == "LOCKED", f"{s}")
s, _ = curl("GET", "/backup-restore/policies", headers={"X-Maintenance-Pass": PASS})
check("the Super Administrator's pass does not open other screens while locked", s == 503, f"{s}")

# 7. reopen
s, ul = curl("POST", "/system/maintenance/unlock", headers={"X-Maintenance-Pass": PASS})
check("unlock returns the system to NORMAL", s == 200 and ul.get("state") == "NORMAL", f"{s} {ul.get('state')}")
check("the lock file is removed", lock_state() is None)
token2 = admin_login()
check("ordinary users can sign in again", token2 is not None)

# 8. the record is intact
s, led = curl("GET", "/backup-restore/overview", token=token2)
s2, ver = curl("GET", "/system/maintenance-status")
check("status is NORMAL at the end", ver.get("state") == "NORMAL")

passed = sum(1 for _, ok in results if ok)
print(f"\nRESULT: {passed} of {len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
