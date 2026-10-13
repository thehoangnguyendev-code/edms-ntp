#!/usr/bin/env bash
# DEV only. Gives the DEV test account approver.test1 the backup APPROVER rights (policy approve, export approve) through the
# eQMS security API, as the admin account, with an electronic signature for each change (SDS 11.6 / BR-10).
# It does not give propose or request rights, so the same person cannot both propose and approve.
# The passwords are read from the environment; nothing is written to disk.
#   ADMIN_PW=... APPROVER_PW=... bash scripts/backup/dev-grant-backup-approver.sh
set -euo pipefail
[ "${EQMS_ENVIRONMENT:-DEV}" = "DEV" ] || { echo "DEV only"; exit 2; }
: "${ADMIN_PW:?set ADMIN_PW}"
: "${APPROVER_PW:?set APPROVER_PW}"
cd "$(dirname "$0")/../.."
call() { docker exec -i eqms-backend curl -s -w '\n%{http_code}' -X "$1" -H "Authorization: Bearer ${TOKEN:-}" -H "Content-Type: application/json" ${3:+-d "$3"} "http://localhost:5000/api$2"; }
body() { printf '%s' "$1" | sed '$d'; }
code() { printf '%s' "$1" | tail -n1; }
jget() { python -c "import sys,json; print(json.load(sys.stdin)$1)"; }

echo "1. admin signs in"
R="$(docker exec -i eqms-backend curl -s -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"identifier\":\"admin\",\"password\":\"$ADMIN_PW\"}" http://localhost:5000/api/auth/login)"
[ "$(code "$R")" = 200 ] || { echo "admin login failed: $(code "$R")"; exit 1; }
TOKEN="$(body "$R" | jget "['accessToken']")"

sig() {
  R="$(docker exec -i eqms-backend curl -s -w '\n%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}" http://localhost:5000/api/auth/verify-signature)"
  [ "$(code "$R")" = 200 ] || { echo "e-signature refused: $(body "$R")"; exit 1; }
  body "$R" | jget "['signatureToken']"
}

echo "2. the approver's current permission sets"
R="$(docker exec -i eqms-backend curl -s -w '\n%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/security/access-profiles/2bceb402-eb84-485d-a90c-281daf697a48/permission-sets)"
echo "   HTTP $(code "$R")"
EXISTING="$(body "$R" | python -c "import sys,json; print(json.dumps([p['id'] for p in json.load(sys.stdin)]))")"
echo "   $EXISTING"

echo "3. create a permission set with only the approver rights"
CODES='["backup.module.view","backup.admin.view","backup.admin.policy.view","backup.admin.policy.approve","backup.admin.storage.view","backup.backup.export.approve"]'
S1="$(sig)"
R="$(call POST /security/permission-sets "{\"name\":\"Backup Approver (DEV test)\",\"code\":\"PS_BACKUP_APPROVER_TEST\",\"description\":\"DEV test: approves backup policy changes and backup exports. Cannot propose or request.\",\"active\":true,\"permissionCodes\":$CODES,\"signatureToken\":\"$S1\",\"reason\":\"DEV two-person backup test\"}")"
[ "$(code "$R")" = 200 ] || { echo "create failed: $(code "$R") $(body "$R")"; exit 1; }
PS="$(body "$R" | jget "['id']")"
echo "   created $PS"

echo "4. attach it to the approver's access profile"
S2="$(sig)"
NEW="$(python -c "import json,sys; ids=json.loads(sys.argv[1]); ids.append(sys.argv[2]); print(json.dumps(ids))" "$EXISTING" "$PS")"
R="$(call PUT /security/access-profiles/2bceb402-eb84-485d-a90c-281daf697a48/permission-sets "{\"permissionSetIds\":$NEW,\"signatureToken\":\"$S2\",\"reason\":\"DEV two-person backup test\"}")"
[ "$(code "$R")" = 200 ] || [ "$(code "$R")" = 204 ] || { echo "attach failed: $(code "$R") $(body "$R")"; exit 1; }
echo "   attached"

echo "5. check the approver's rights (approver signs in)"
R="$(docker exec -i eqms-backend curl -s -w '\n%{http_code}' -X POST -H 'Content-Type: application/json' -d "{\"identifier\":\"approver.test1\",\"password\":\"$APPROVER_PW\"}" http://localhost:5000/api/auth/login)"
AT="$(body "$R" | jget "['accessToken']")"
probe() { docker exec -i eqms-backend curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $AT" "http://localhost:5000/api$1"; }
echo "   view policies:   HTTP $(probe /backup-restore/policies)   (expect 200)"
echo "   view storage:    HTTP $(probe /backup-restore/media)   (expect 200)"
echo "   propose policy:  HTTP $(docker exec -i eqms-backend curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"reason":"probe"}' http://localhost:5000/api/backup-restore/policies)   (expect 403)"
echo "   request restore test: HTTP $(docker exec -i eqms-backend curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"reason":"probe"}' http://localhost:5000/api/backup-restore/backups/BK-20261008-1900-0017/rehearsals)   (expect 403)"
