#!/usr/bin/env bash
# End-to-end check of the restore rehearsal (SDS 14.1, 14.3) on the running DEV stack. It asks for a test restore of the newest
# verified backup through the agent API, waits for the restore worker, and checks: the checks ran and passed, the scratch database
# is gone, the production database is unchanged, the API process holds no private key, and the ledger verifies.
# DEV only. Needs the restore worker running (docker-compose.backup-restore.yml, profile restore-worker).
set -uo pipefail
cd "$(dirname "$0")/../.."
[ "${EQMS_ENVIRONMENT:-DEV}" = "DEV" ] || { echo "DEV only"; exit 2; }
TOKEN="$(grep '^BACKUP_AGENT_API_TOKEN=' .env | cut -d= -f2- | tr -d '\r')"
AGENT=eqms-backup-agent
pass=0; failn=0
ok()  { echo "  PASS  $1"; pass=$((pass+1)); }
bad() { echo "  FAIL  $1"; failn=$((failn+1)); }
api() { docker exec -i "$AGENT" curl -s -w '\n%{http_code}' -X "$1" -H "X-Agent-Token: $TOKEN" -H "Content-Type: application/json" ${3:+-d "$3"} "http://localhost:5600$2"; }
code() { printf '%s' "$1" | tail -n1; }
body() { printf '%s' "$1" | sed '$d'; }
jget() { python -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }

echo "0. Preconditions"
docker ps --format '{{.Names}}' | grep -q '^eqms-backup-restore-worker$' && ok "restore worker is running" || { bad "restore worker is not running"; exit 1; }
docker exec "$AGENT" sh -c 'test ! -e /restore-keys' && ok "the API agent holds no private key" || bad "the API agent can see the private key folder"

BACKUP="$(docker exec eqms-backup-control psql -U eqms_backup -d eqms_backup_control -At -c "select r.backup_id from backup_run r where r.status='COMPLETED' and (select result from backup_verification v where v.run_id=r.id order by verified_at desc limit 1)='VERIFIED' order by r.started_at desc limit 1")"
[ -n "$BACKUP" ] && ok "a verified backup exists: $BACKUP" || { bad "no verified backup"; exit 1; }

PROD_BEFORE="$(docker exec eqms-postgres psql -U eqms -d eqms-database -Atc "select count(*) from documents")"

echo "1. Ask for the test restore"
R="$(api POST "/internal/backups/$BACKUP/rehearsals" '{"by":"tester.e2e","reason":"P3 end-to-end check"}')"
[ "$(code "$R")" = 202 ] && ok "requested" || bad "request refused: $(body "$R")"
RH="$(body "$R" | jget "['rehearsalId']")"
R="$(api POST "/internal/backups/$BACKUP/rehearsals" '{"by":"tester.e2e","reason":"second"}')"
[ "$(code "$R")" = 409 ] && ok "a second test is refused while one is open" || bad "second test accepted"

echo "2. Wait for the worker"
STATUS=""
for i in $(seq 1 120); do
  R="$(api GET "/internal/rehearsals/$RH")"; STATUS="$(body "$R" | jget "['status']")"
  [ "$STATUS" = PASSED ] || [ "$STATUS" = FAILED ] && break
  sleep 3
done
[ "$STATUS" = PASSED ] && ok "rehearsal $RH passed" || bad "status $STATUS: $(body "$R" | jget "['errorCode']")"

echo "3. The checks"
for code in MANIFEST_SIGNATURE DECRYPTION_KEY RESTORE_DATABASE C1 C2 C3 C4 C6 C6_INDEX; do
  body "$R" | python -c "import sys,json; d=json.load(sys.stdin); c=[x for x in d['checks'] if x['code']=='$code']; sys.exit(0 if c and c[0]['ok'] else 1)" \
    && ok "$code" || bad "$code"
done

echo "4. Nothing is left behind, production is unchanged"
docker exec eqms-postgres psql -U eqms -d postgres -Atc "select count(*) from pg_database where datname like 'eqms_restore_%'" | grep -qx 0 && ok "no scratch database remains" || bad "a scratch database remains"
PROD_AFTER="$(docker exec eqms-postgres psql -U eqms -d eqms-database -Atc "select count(*) from documents")"
[ "$PROD_BEFORE" = "$PROD_AFTER" ] && ok "production documents unchanged ($PROD_AFTER)" || bad "production changed: $PROD_BEFORE -> $PROD_AFTER"

echo "5. The record is intact"
R="$(api GET /internal/ledger/verify)"
body "$R" | grep -q '"ok":true' && ok "ledger chain verifies" || bad "ledger: $(body "$R")"

echo "RESULT: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
