#!/usr/bin/env bash
# End-to-end check of Export Backup Set and the Offline Media Register against the running DEV stack (agent API, real gpg, real files).
# It registers a DEV test medium, exports the newest verified backup, proves the same-person refusal, checks the package with the
# tool that ships inside it, decrypts the database with the DEV private key, and shows that tampering is caught.
# Names used below are labels for this test, not eQMS users. DEV only.
set -uo pipefail
cd "$(dirname "$0")/../.."
TOKEN="$(grep '^BACKUP_AGENT_API_TOKEN=' .env | cut -d= -f2- | tr -d '\r')"
AGENT=eqms-backup-agent
pass=0; failn=0
ok()   { echo "  PASS  $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; failn=$((failn+1)); }
api()  { docker exec -i "$AGENT" curl -s -w '\n%{http_code}' -X "$1" -H "X-Agent-Token: $TOKEN" -H "Content-Type: application/json" ${3:+-d "$3"} "http://localhost:5600$2"; }
code() { printf '%s' "$1" | tail -n1; }
body() { printf '%s' "$1" | sed '$d'; }
jget() { python -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }

[ "${EQMS_ENVIRONMENT:-DEV}" = "DEV" ] || { echo "DEV only"; exit 2; }
STAMP="$(date +%H%M%S)"
BACKUP="$(docker exec eqms-backup-control psql -U eqms_backup -d eqms_backup_control -At -c "select r.backup_id from backup_run r where r.status='COMPLETED' and (select result from backup_verification v where v.run_id=r.id order by verified_at desc limit 1)='VERIFIED' order by r.started_at desc limit 1")"
echo "Backup used: $BACKUP"
[ -n "$BACKUP" ] || { echo "no verified backup"; exit 2; }

echo "1. Register a medium"
R="$(api POST /internal/media "{\"label\":\"E2E-$STAMP\",\"serialNumber\":\"SN-$STAMP\",\"kind\":\"USB\",\"capacityBytes\":2000000000,\"exportDir\":\"e2e-$STAMP\",\"by\":\"custodian.test\"}")"
[ "$(code "$R")" = 201 ] && ok "medium registered" || bad "register: $(body "$R")"
MID="$(body "$R" | jget "['id']")"
R="$(api POST /internal/media "{\"label\":\"E2E-$STAMP\",\"serialNumber\":\"x\",\"kind\":\"USB\",\"capacityBytes\":1,\"exportDir\":\"other-$STAMP\",\"by\":\"custodian.test\"}")"
[ "$(code "$R")" = 409 ] && ok "duplicate label refused" || bad "duplicate label accepted"
R="$(api POST /internal/media "{\"label\":\"E2E-X$STAMP\",\"serialNumber\":\"x\",\"kind\":\"USB\",\"capacityBytes\":1,\"exportDir\":\"../escape\",\"by\":\"custodian.test\"}")"
[ "$(code "$R")" = 400 ] && ok "folder outside the export root refused" || bad "path escape accepted"

echo "2. Request, refuse self-approval, approve"
R="$(api POST "/internal/backups/$BACKUP/exports" "{\"mediaId\":\"$MID\",\"reason\":\"E2E check\",\"by\":\"requester.test\"}")"
[ "$(code "$R")" = 201 ] && ok "export requested" || bad "request: $(body "$R")"
EID="$(body "$R" | jget "['exportId']")"
R="$(api POST "/internal/exports/$EID/approve" '{"by":"requester.test"}')"
[ "$(code "$R")" = 409 ] && ok "requester cannot approve their own export" || bad "self-approval allowed"
R="$(api POST "/internal/exports/$EID/approve" '{"by":"approver.test"}')"
[ "$(code "$R")" = 200 ] && ok "approved by another person" || bad "approve: $(body "$R")"

echo "3. Wait for the agent to build the package"
STATUS=""
for i in $(seq 1 120); do
  R="$(api GET "/internal/exports/$EID")"; STATUS="$(body "$R" | jget "['status']")"
  [ "$STATUS" = COMPLETED ] || [ "$STATUS" = INVALID ] && break
  sleep 3
done
[ "$STATUS" = COMPLETED ] && ok "package completed" || { bad "package status $STATUS: $(body "$R")"; echo "RESULT: $pass passed, $failn failed"; exit 1; }
PKG_IN="$(body "$R" | jget "['packagePath']")"
PKG="backups/dev/export/${PKG_IN#/backup/export/}"
echo "   package: $PKG ($(du -sh "$PKG" | cut -f1))"

echo "4. Check the package with the tool inside it"
sh "$PKG/tools/verify-chain.sh" "$PKG" > /tmp/verify1.out 2>&1 && ok "verify-chain.sh passes on the package" || { bad "verify-chain.sh failed"; cat /tmp/verify1.out; }

echo "5. Decrypt the database with the DEV private key"
MAGIC="$(GNUPGHOME="$PWD/backups/dev-keys/gnupg-home" gpg --batch -d "$PKG/database/eqms.dump.gpg" 2>/dev/null | head -c 5)"
[ "$MAGIC" = PGDMP ] && ok "database dump decrypts and is a PostgreSQL dump" || bad "database dump did not decrypt"
BLOB="$(docker exec eqms-backup-control psql -U eqms_backup -d eqms_backup_control -At -F'|' -c "select blob_path, plain_sha256 from backup_object_blob order by random() limit 1")"
BP="${BLOB%%|*}"; BS="${BLOB##*|}"
GOT="$(GNUPGHOME="$PWD/backups/dev-keys/gnupg-home" gpg --batch -d "$PKG/$BP" 2>/dev/null | sha256sum | cut -d' ' -f1)"
[ "$GOT" = "$BS" ] && ok "a stored document decrypts to its recorded SHA-256" || bad "document did not match"

echo "6. Tampering is caught"
COPY="$(mktemp -d)"; cp -r "$PKG/." "$COPY/"
printf 'x' >> "$COPY/database/eqms.dump.gpg"
sh "$COPY/tools/verify-chain.sh" "$COPY" > /dev/null 2>&1 && bad "a changed file went unnoticed" || ok "a changed file is reported"
rm -rf "$COPY"; COPY="$(mktemp -d)"; cp -r "$PKG/." "$COPY/"
sed -i 's/"environment":"DEV"/"environment":"PRD"/' "$COPY/EXPORT-RECEIPT.json"
sh "$COPY/tools/verify-chain.sh" "$COPY" > /dev/null 2>&1 && bad "a changed receipt went unnoticed" || ok "a changed receipt is reported"
rm -rf "$COPY"

echo "7. The medium travels: handover and receipt by two people"
R="$(api POST "/internal/media/$MID/receive" '{"by":"keeper.test"}')"
[ "$(code "$R")" = 409 ] && ok "cannot receive before a handover" || bad "received without handover"
api POST "/internal/media/$MID/handover" '{"holder":"Keeper Test","location":"Test safe","by":"courier.test"}' > /dev/null
R="$(api POST "/internal/media/$MID/receive" '{"by":"courier.test"}')"
[ "$(code "$R")" = 409 ] && ok "deliverer cannot confirm their own handover" || bad "same person received"
R="$(api POST "/internal/media/$MID/receive" '{"by":"keeper.test"}')"
[ "$(code "$R")" = 200 ] && [ "$(body "$R" | jget "['status']")" = STORED_OFFSITE ] && ok "stored off-site after a second person confirms" || bad "receive: $(body "$R")"

echo "8. The record is intact"
R="$(api GET /internal/ledger/verify)"
body "$R" | grep -q '"ok":true' && ok "ledger chain verifies" || bad "ledger: $(body "$R")"
echo "RESULT: $pass passed, $failn failed"
[ "$failn" -eq 0 ]
