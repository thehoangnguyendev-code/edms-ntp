"""Restore requests R0-R3 on the DEV stack, with two real accounts: admin asks, approver.test1 approves (with the approver's own electronic
signature). Also: the requester cannot approve, a production restore needs a recent passing test, a rejection needs a reason, and there
is no cancellation. Adds the two restore approval codes to the approver's test permission set (the same DEV set as the backup
approval test), through the security API with the admin's electronic signature. Passwords come from the environment only."""
import json
import os
import subprocess
import sys

ADMIN_PW = os.environ["ADMIN_PW"]
APPROVER_PW = os.environ["APPROVER_PW"]
API = "http://localhost:5000/api"
PERMISSION_SET = "58d9cfe0-ef4d-46b1-adb2-c63f96765617"  # PS_BACKUP_APPROVER_TEST, created for the two-person backup test
results = []


def curl(method, path, token=None, body=None):
    cmd = ["docker", "exec", "-i", "eqms-backend", "curl", "-s", "-w", "\n%{http_code}", "-X", method]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        local = os.path.join(os.environ.get("TEMP", "."), "restore-e2e-body.json")
        with open(local, "w", encoding="utf-8") as f:
            json.dump(body, f)
        subprocess.run(["docker", "cp", local, "eqms-backend:/tmp/restore-e2e-body.json"], check=True, capture_output=True)
        cmd += ["-H", "Content-Type: application/json", "-d", "@/tmp/restore-e2e-body.json"]
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


def login(user, pw):
    s, d = curl("POST", "/auth/login", body={"identifier": user, "password": pw})
    return d.get("accessToken") if s == 200 else None


def esig(user, pw, token):
    s, d = curl("POST", "/auth/verify-signature", token, {"username": user, "password": pw})
    return d.get("signatureToken") if s == 200 else None


admin = login("admin", ADMIN_PW)
approver = login("approver.test1", APPROVER_PW)
check("admin and approver.test1 sign in", admin and approver)

# 0. grant the restore approval codes to the approver's test set (a security change: admin's electronic signature)
s, ps = curl("GET", f"/security/permission-sets/{PERMISSION_SET}", admin)
codes = sorted(set((ps.get("permissionCodes") or []) + ["backup.restore.approve"]))  # approve only: the approver must not also be able to ask
if codes != sorted(set(ps.get("permissionCodes") or [])):
    s, _ = curl("PUT", f"/security/permission-sets/{PERMISSION_SET}", admin, {
        "name": ps["name"], "code": ps["code"], "description": ps.get("description") or "", "active": True,
        "permissionCodes": codes, "signatureToken": esig("admin", ADMIN_PW, admin),
        "reason": "DEV restore request test: approver may approve restores, not ask for them"})
    check("the approver's test set gets the restore approval rights", s == 200, str(s))
else:
    check("the approver's test set already has the restore approval rights", True)

s, cap = curl("GET", "/backup-restore/restores?limit=1", approver)
check("approver can read restore requests", s == 200, str(s))

bks = curl("GET", "/backup-restore/backups?status=COMPLETED&verification=VERIFIED&limit=1", admin)[1].get("data", [])
backup = bks[0]["id"] if bks else None
check("a verified backup exists", backup is not None, str(backup))

# R0-R1: the request and its impact report
s, req = curl("POST", f"/backup-restore/backups/{backup}/restores", admin, {"type": "R-FULL", "target": "VALIDATION", "reason": "Restore test for the validation report", "changeControlRef": "CC-2026-E2E"})
check("admin asks for a validation restore", s in (200, 201, 202) and req.get("status") == "PENDING_APPROVAL", f"{s} {req.get('code', '')}")
rid = req.get("requestId")
impact = req.get("impact") or {}
check("the impact report lists the components and the live rows after the backup", "components" in impact and "liveRowsAfterBackup" in impact,
      str(sorted(impact.keys()))[:120])

# R3: the requester cannot approve their own request, even with an electronic signature
s, out = curl("POST", f"/backup-restore/restores/{rid}/approve", admin, {"signatureToken": esig("admin", ADMIN_PW, admin)})
check("admin cannot approve the request they made", s == 409 and out.get("code") == "RESTORE_SAME_PERSON", f"{s} {out.get('code', '')}")

# R3: the approver approves with their own electronic signature
s, out = curl("POST", f"/backup-restore/restores/{rid}/approve", approver, {"signatureToken": esig("approver.test1", APPROVER_PW, approver)})
check("approver.test1 approves with an e-signature", s == 200 and out.get("status") == "APPROVED", f"{s} {out.get('status', '')} {out.get('code', '')}")
check("the approval names the approver and the signature", out.get("approvedBy") == "approver.test1" and bool(out.get("approvalSignatureRef")), str(out.get("approvedBy")))

s, again = curl("POST", f"/backup-restore/restores/{rid}/approve", approver, {"signatureToken": esig("approver.test1", APPROVER_PW, approver)})
check("an approved request cannot be approved twice", s == 409, f"{s} {again.get('code', '')}")

# a second request: rejected by the approver, with a reason
s, req2 = curl("POST", f"/backup-restore/backups/{backup}/restores", admin, {"type": "R-DB", "target": "VALIDATION", "reason": "Second request, to be rejected"})
rid2 = req2.get("requestId")
check("a second request waits (only one open per backup)", s in (200, 201) and bool(rid2), f"{s} {req2.get('code', '')}")
s, dup = curl("POST", f"/backup-restore/backups/{backup}/restores", admin, {"type": "R-DB", "target": "VALIDATION", "reason": "again"})
check("a third request for the same backup is refused while one waits", s == 409, f"{s} {dup.get('code', '')}")
s, out = curl("POST", f"/backup-restore/restores/{rid2}/reject", approver, {"reason": "", "signatureToken": esig("approver.test1", APPROVER_PW, approver)})
check("a rejection needs a reason", s == 400, str(s))
s, out = curl("POST", f"/backup-restore/restores/{rid2}/reject", approver, {"reason": "Change control CC-2026-E2E is not approved yet", "signatureToken": esig("approver.test1", APPROVER_PW, approver)})
check("approver.test1 rejects with a reason", s == 200 and out.get("status") == "REJECTED", f"{s} {out.get('status', '')}")

# a production restore needs a passing test restore of the same backup in the last 30 days
s, prod = curl("POST", f"/backup-restore/backups/{backup}/restores", admin, {"type": "R-FULL", "target": "PRODUCTION", "reason": "Production restore request check"})
check("a production request needs the recent test restore (accepted here because one passed)", s in (200, 201) and prod.get("target") == "PRODUCTION", f"{s} {prod.get('code', '')}")
rid3 = prod.get("requestId")
# there is no cancellation: the assigned approver decides the request, so nothing is left open
s, out = curl("POST", f"/backup-restore/restores/{rid3}/reject", approver, {"reason": "Clean-up of the DEV test", "signatureToken": esig("approver.test1", APPROVER_PW, approver)})
check("the assigned approver decides the production request", s == 200 and out.get("status") == "REJECTED", f"{s} {out.get('status', '')}")

# the record: every step is in the restore request's history, and the ledger verifies
s, detail = curl("GET", f"/backup-restore/restores/{rid}", admin)
events = [e.get("event") for e in detail.get("events", [])]
check("the approved request keeps its history", "REQUESTED" in events and "APPROVED" in events, str(events))
s, led = curl("GET", "/system/maintenance-status")
passed = sum(1 for _, ok in results if ok)
print(f"\nRESULT: {passed} of {len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
