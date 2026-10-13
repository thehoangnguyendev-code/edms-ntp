"""The manual maintenance switch (System Administration > Configuration > General) on the DEV stack: an ordinary user is held at the
maintenance page while it is on, an administrator with the bypass permission keeps working, and switching it off reopens the system.
Passwords come from the environment only. The switch is put back to off at the end, whatever happens."""
import json
import os
import subprocess
import sys

ADMIN_PW = os.environ["ADMIN_PW"]
USER_PW = os.environ["USER_PW"]
API = "http://localhost:5000/api"
results = []


def curl(method, path, token=None, body=None):
    cmd = ["docker", "exec", "-i", "eqms-backend", "curl", "-s", "-w", "\n%{http_code}", "-X", method]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        # a full configuration is too long for a command line on Windows: send it as a file copied into the container
        local = os.path.join(os.environ.get("TEMP", "."), "maint-switch-body.json")
        with open(local, "w", encoding="utf-8") as f:
            json.dump(body, f)
        subprocess.run(["docker", "cp", local, "eqms-backend:/tmp/maint-switch-body.json"], check=True, capture_output=True)
        cmd += ["-H", "Content-Type: application/json", "-d", "@/tmp/maint-switch-body.json"]
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
    return (d.get("accessToken"), d) if s == 200 else (None, d)


def set_switch(admin_token, value):
    s, cfg = curl("GET", "/settings/system", admin_token)
    general = dict(cfg.get("general", {}))
    general["maintenanceMode"] = value
    payload = {k: cfg[k] for k in ("general", "security", "documents", "notifications", "integrations", "features") if k in cfg}
    payload["general"] = general
    return curl("PUT", "/settings/system", admin_token, payload)[0]


admin_token, _ = login("admin", ADMIN_PW)
user_token, _ = login("author.test1", USER_PW)
check("admin and author.test1 sign in", admin_token and user_token)

try:
    s, _ = curl("GET", "/documents?page=1&limit=1", user_token)
    check("before: the author works normally", s == 200, str(s))

    check("the admin switches maintenance mode on", set_switch(admin_token, True) in (200, 204))

    s, body = curl("GET", "/documents?page=1&limit=1", user_token)
    check("the author is held while the switch is on", s == 503 and body.get("code") == "MAINTENANCE_MODE", f"{s} {body.get('code')}")

    s, body = curl("GET", "/documents?page=1&limit=1", admin_token)
    check("the administrator (bypass permission) keeps working", s == 200, str(s))

    _, login_body = login("author.test1", USER_PW)
    check("the author's sign-in reports the switch to the page", login_body.get("user", {}).get("maintenanceMode") is True
          or login_body.get("maintenanceMode") is True or "maintenanceMode" in json.dumps(login_body))

    s, st = curl("GET", "/system/maintenance-status")
    check("the public status reports the manual switch", st.get("manual") is True, str(st.get("manual")))
finally:
    off = set_switch(admin_token, False)
    check("the switch is put back to off", off in (200, 204), str(off))

s, _ = curl("GET", "/documents?page=1&limit=1", user_token)
check("after: the author works again", s == 200, str(s))
s, st = curl("GET", "/system/maintenance-status")
check("the public status shows no manual switch", st.get("manual") is False, str(st.get("manual")))

passed = sum(1 for _, ok in results if ok)
print(f"\nRESULT: {passed} of {len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
