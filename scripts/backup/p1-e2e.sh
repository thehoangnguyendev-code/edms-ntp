#!/bin/bash
# End-to-end check of P1 (SDS-BR-001, OQ-01, OQ-06, OQ-07, OQ-12, OQ-13) against the running DEV stack.
# It takes a REAL backup of the DEV database with the real pg_dump and gpg, then damages the stored copy in several ways and
# shows that each one is found. Every change it makes is undone, and the ledger is left intact.
# Usage: bash scripts/backup/p1-e2e.sh        (needs: docker compose up -d backup-control backup-agent)
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
TOKEN="$(grep '^BACKUP_AGENT_API_TOKEN=' .env | cut -d= -f2- | tr -d '\r')"
AGENT=eqms-backup-agent
CTL=eqms-backup-control
PASS=0; FAIL=0
TAG=$(date +%s)

api() { # method path [json]
  if [ -n "${3:-}" ]; then
    docker exec "$AGENT" curl -s -X "$1" -H "X-Agent-Token: $TOKEN" -H "Content-Type: application/json" -d "$3" "http://localhost:5600$2"
  else
    docker exec "$AGENT" curl -s -X "$1" -H "X-Agent-Token: $TOKEN" "http://localhost:5600$2"
  fi
}
py() { python -c "import sys,json; d=json.load(sys.stdin); print($1)"; }
check() { # description condition(0=ok)
  if [ "$2" = "0" ]; then echo "  PASS  $1"; PASS=$((PASS+1)); else echo "  FAIL  $1"; FAIL=$((FAIL+1)); fi
}
wait_job() { # jobId -> prints status
  for i in $(seq 1 120); do
    s=$(api GET "/internal/jobs/$1" | py "d['status']")
    [ "$s" = "DONE" ] || [ "$s" = "FAILED" ] && { echo "$s"; return; }
    sleep 3
  done
  echo TIMEOUT
}
verify() { # backupId -> prints VERIFIED/FAILED (runs a new V1)
  job=$(api POST "/internal/backups/$1/verify" '{"requestedBy":"e2e.operator"}' | py "d['jobId']")
  wait_job "$job" >/dev/null
  api GET "/internal/backups/$1" | py "d['verification']"
}
sql() { docker exec -i "$CTL" psql -U eqms_backup -d eqms_backup_control -At -c "$1"; }

echo "== 0. agent and unauthenticated access"
code=$(docker exec "$AGENT" curl -s -o /dev/null -w "%{http_code}" http://localhost:5600/internal/backups)
check "the internal API refuses a call without the shared secret (got $code)" $([ "$code" = "401" ] && echo 0 || echo 1)

echo "== 1. a real backup (pg_dump + gpg) of the DEV database"
t0=$(date +%s)
job=$(api POST /internal/backups '{"requestedBy":"e2e.operator","reason":"P1 end-to-end check"}' | py "d['jobId']")
st=$(wait_job "$job")
t1=$(date +%s)
check "the backup job finished (status $st, $((t1-t0))s)" $([ "$st" = "DONE" ] && echo 0 || echo 1)
BK=$(api GET "/internal/jobs/$job" | py "json.loads(d['result_json'])['backupId']")
detail=$(api GET "/internal/backups/$BK")
echo "$detail" | py "'  backup %s, %s bytes, verification %s, schema V%s' % (d['id'], d['sizeBytes'], d['verification'], d['schemaVersion'])"
check "the backup is COMPLETED" $([ "$(echo "$detail" | py "d['status']")" = "COMPLETED" ] && echo 0 || echo 1)
check "verification V1 is VERIFIED straight after the backup" $([ "$(echo "$detail" | py "d['verification']")" = "VERIFIED" ] && echo 0 || echo 1)

DIR=$(echo "$detail" | py "d['locations'][0]['path']")           # /backup/t1/DEV/yyyy/MM/BK-...
HOSTDIR="$ROOT/backups/dev/t1/${DIR#/backup/t1/}"
FILE="$HOSTDIR/database/eqms.dump.gpg"
check "the set exists on the server folder: manifest, signature, checksums, encrypted dump" $([ -f "$HOSTDIR/manifest.json" ] && [ -f "$HOSTDIR/manifest.sig" ] && [ -f "$HOSTDIR/SHA256SUMS" ] && [ -f "$FILE" ] && echo 0 || echo 1)
head -c 40 "$FILE" | od -An -c | head -1 | grep -q "PGDMP" && plain=1 || plain=0
check "the dump on disk is encrypted (no PGDMP header)" $([ "$plain" = "0" ] && echo 0 || echo 1)

echo "== 2. the encrypted file is a real OpenPGP message that only the private key can open"
GNUPGHOME="$ROOT/backups/dev-keys/gnupg-home" gpg --batch -d "$FILE" 2>/dev/null | head -c 5 | grep -q "PGDMP"
check "decrypting with the private key (kept OUTSIDE the agent) gives a PostgreSQL custom-format dump" $([ $? -eq 0 ] && echo 0 || echo 1)
MSYS_NO_PATHCONV=1 docker exec "$AGENT" sh -c "GNUPGHOME=/tmp/agent-gnupg gpg --batch -d $DIR/database/eqms.dump.gpg >/dev/null 2>&1; echo \$? > /tmp/gpg.rc; cat /tmp/gpg.rc" | grep -qv '^0$'
check "the agent itself CANNOT decrypt (it holds only the public key)" $([ $? -eq 0 ] && echo 0 || echo 1)

echo "== 3. the dump restores into a scratch database and matches the manifest (row counts)"
SCRATCH=eqms_p1_e2e_restore
PGU=$(grep '^POSTGRES_USER=' .env | cut -d= -f2- | tr -d '\r')
docker exec eqms-postgres psql -U "$PGU" -d postgres -qc "drop database if exists $SCRATCH" -c "create database $SCRATCH"
GNUPGHOME="$ROOT/backups/dev-keys/gnupg-home" gpg --batch -d "$FILE" 2>/dev/null | docker exec -i eqms-postgres pg_restore -U "$PGU" -d $SCRATCH --no-owner --exit-on-error
check "pg_restore of the decrypted dump finished without error" $([ ${PIPESTATUS[1]} -eq 0 ] && echo 0 || echo 1)
python - "$HOSTDIR/manifest.json" > /tmp/e2e_counts_manifest.txt <<'PY'
import json,sys
m=json.load(open(sys.argv[1],encoding='utf-8'))
for t,c in sorted(m['components'][0]['rowCounts'].items()): print(f"{t}|{c}")
PY
docker exec eqms-postgres psql -U "$PGU" -d $SCRATCH -At -c "select string_agg(format('select %L as t, count(*) as c from public.%I', tablename, tablename), ' union all ' order by tablename) from pg_tables where schemaname='public'" > /tmp/e2e_q.sql
docker exec -i eqms-postgres psql -U "$PGU" -d $SCRATCH -At < /tmp/e2e_q.sql | sort > /tmp/e2e_counts_restored.txt
sort /tmp/e2e_counts_manifest.txt > /tmp/e2e_counts_manifest_sorted.txt
diff -q /tmp/e2e_counts_manifest_sorted.txt /tmp/e2e_counts_restored.txt >/dev/null
check "row counts of every table in the restored copy equal the counts recorded in the manifest ($(wc -l < /tmp/e2e_counts_restored.txt) tables)" $([ $? -eq 0 ] && echo 0 || echo 1)
lo_manifest=$(python -c "import json,sys;print(json.load(open(sys.argv[1],encoding='utf-8'))['components'][0]['largeObjectCount'])" "$HOSTDIR/manifest.json")
lo_restored=$(docker exec eqms-postgres psql -U "$PGU" -d $SCRATCH -At -c "select count(*) from pg_largeobject_metadata")
check "the number of large objects in the restored copy equals the manifest ($lo_restored of $lo_manifest)" $([ "$lo_manifest" = "$lo_restored" ] && echo 0 || echo 1)
docker exec eqms-postgres psql -U "$PGU" -d postgres -qc "drop database $SCRATCH"
rm -f /tmp/e2e_counts_*.txt /tmp/e2e_q.sql

echo "== 4. OQ-06: one changed byte in the stored dump is found, and the good result is kept"
python - "$FILE" <<'PY'
import sys
p=sys.argv[1]; b=bytearray(open(p,'rb').read()); b[100]^=1; open(p,'wb').write(b)
PY
r=$(verify "$BK")
check "after changing one byte, verification says FAILED (got $r)" $([ "$r" = "FAILED" ] && echo 0 || echo 1)
python - "$FILE" <<'PY'
import sys
p=sys.argv[1]; b=bytearray(open(p,'rb').read()); b[100]^=1; open(p,'wb').write(b)
PY
r=$(verify "$BK")
check "after putting the byte back, verification says VERIFIED again (got $r)" $([ "$r" = "VERIFIED" ] && echo 0 || echo 1)
n=$(sql "select count(*) from backup_verification where run_id=(select id from backup_run where backup_id='$BK')")
check "every verification is kept as history (found $n results, none overwritten)" $([ "$n" -ge 3 ] && echo 0 || echo 1)

echo "== 5. OQ-07: an edited manifest is found by the signature"
cp "$HOSTDIR/manifest.json" "$HOSTDIR/manifest.json.orig"
sed -i 's/"environment":"DEV"/"environment":"PROD"/' "$HOSTDIR/manifest.json"
r=$(verify "$BK")
check "after editing manifest.json, verification says FAILED (got $r)" $([ "$r" = "FAILED" ] && echo 0 || echo 1)
mv "$HOSTDIR/manifest.json.orig" "$HOSTDIR/manifest.json"
r=$(verify "$BK")
check "after restoring manifest.json, verification says VERIFIED (got $r)" $([ "$r" = "VERIFIED" ] && echo 0 || echo 1)

echo "== 6. a second backup follows the first in the chain"
job2=$(api POST /internal/backups "{\"requestedBy\":\"e2e.operator\",\"reason\":\"P1 chain check $TAG\"}" | py "d['jobId']")
wait_job "$job2" >/dev/null
BK2=$(api GET "/internal/jobs/$job2" | py "json.loads(d['result_json'])['backupId']")
prev=$(sql "select previous_manifest_sha256 from backup_manifest where run_id=(select id from backup_run where backup_id='$BK2')")
first=$(sql "select manifest_sha256 from backup_manifest where run_id=(select id from backup_run where backup_id='$BK')")
check "backup $BK2 records the manifest hash of $BK as its predecessor" $([ "$prev" = "$first" ] && echo 0 || echo 1)

echo "== 7. OQ-12 / OQ-13: the ledger"
v=$(api GET /internal/ledger/verify)
echo "$v" | py "'  ledger: ok=%s, %s events, file copy compared=%s' % (d['ok'], d['checked'], d['fileCopyCompared'])"
check "the ledger chain verifies and was compared with its copy outside the database" $([ "$(echo "$v" | py "d['ok'] and d['fileCopyCompared']")" = "True" ] && echo 0 || echo 1)
out=$(sql "update ledger_event set actor='intruder' where seq=1" 2>&1)
echo "$out" | grep -q "append-only"
check "the database refuses to UPDATE a ledger event" $([ $? -eq 0 ] && echo 0 || echo 1)
out=$(sql "delete from backup_manifest" 2>&1)
echo "$out" | grep -q "append-only"
check "the database refuses to DELETE a manifest" $([ $? -eq 0 ] && echo 0 || echo 1)

echo "   now bypass the protection on purpose (DEV owner role) and change event 2, as an attacker with database access might"
orig=$(sql "select data_json from ledger_event where seq=2")
run_sql_file() { # runs the SQL text given as $1 inside the control database container
  printf '%s
' "$1" > "$ROOT/backups/dev/agent/.e2e.sql"
  docker cp "$ROOT/backups/dev/agent/.e2e.sql" "$CTL":/tmp/e2e.sql
  docker exec "$CTL" sh -c 'psql -U eqms_backup -d eqms_backup_control -q -v ON_ERROR_STOP=1 -f /tmp/e2e.sql; rm -f /tmp/e2e.sql'
  rm -f "$ROOT/backups/dev/agent/.e2e.sql"
}
undo_ledger() { run_sql_file "ALTER TABLE ledger_event DISABLE TRIGGER USER; UPDATE ledger_event SET data_json = \$q\$${orig}\$q\$ WHERE seq = 2; ALTER TABLE ledger_event ENABLE TRIGGER USER;"; }
trap undo_ledger EXIT
run_sql_file "ALTER TABLE ledger_event DISABLE TRIGGER USER; UPDATE ledger_event SET data_json = '{\"tampered\":true}' WHERE seq = 2; ALTER TABLE ledger_event ENABLE TRIGGER USER;" >/dev/null
v=$(api GET /internal/ledger/verify)
echo "$v" | py "'  ledger: ok=%s, first broken event=%s, reason=%s' % (d['ok'], d['firstBrokenSeq'], d['reason'])"
check "the changed event is found" $([ "$(echo "$v" | py "d['ok']")" = "False" ] && echo 0 || echo 1)
undo_ledger
trap - EXIT
v=$(api GET /internal/ledger/verify)
check "after undoing the change the chain verifies again" $([ "$(echo "$v" | py "d['ok']")" = "True" ] && echo 0 || echo 1)

echo "== 8. server-side list: search, filter, sort, page"
l=$(api GET "/internal/backups?status=COMPLETED&sortBy=startedAt&sortDirection=asc&limit=1&page=2")
check "page 2 of 1 shows one row and reports the true total" $([ "$(echo "$l" | py "len(d['data'])==1 and d['pagination']['total']>=2")" = "True" ] && echo 0 || echo 1)
l=$(api GET "/internal/backups?search=chain%20check%20$TAG")
check "searching for a reason finds the second backup" $([ "$(echo "$l" | py "d['pagination']['total']==1")" = "True" ] && echo 0 || echo 1)

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
