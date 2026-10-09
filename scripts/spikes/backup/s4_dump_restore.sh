#!/bin/sh
# S4 spike: baseline pg_dump / pg_restore on a copy of the DEV database.
# Read-only on the source database. The restore target is a throw-away database that is dropped at the end.
set -e
SRC=${POSTGRES_DB:-eqms-database}
SCRATCH=eqms_spike_restore
OUT=/tmp/spike_eqms.dump

now() { date +%s.%N; }
echo "source database: $SRC"
psql -U "$POSTGRES_USER" -d postgres -Atc "select 'source size: ' || pg_size_pretty(pg_database_size('$SRC'))"

t0=$(now)
pg_dump -U "$POSTGRES_USER" -d "$SRC" -Fc --no-owner --no-privileges -f "$OUT"
t1=$(now)
echo "dump seconds: $(echo "$t1 - $t0" | bc)"
ls -l "$OUT" | awk '{print "dump bytes: " $5}'

# the catalogue of the dump can be read without restoring it (check V1)
pg_restore --list "$OUT" | head -3
echo "toc entries: $(pg_restore --list "$OUT" | grep -vc '^;')"

psql -U "$POSTGRES_USER" -d postgres -qc "drop database if exists $SCRATCH"
psql -U "$POSTGRES_USER" -d postgres -qc "create database $SCRATCH"
t2=$(now)
pg_restore -U "$POSTGRES_USER" -d "$SCRATCH" --no-owner --exit-on-error "$OUT"
t3=$(now)
echo "restore seconds: $(echo "$t3 - $t2" | bc)"

# compare exact row counts of every table, source vs restored copy
count_sql="select format('select %L, count(*) from %I.%I', schemaname||'.'||tablename, schemaname, tablename) from pg_tables where schemaname='public' order by 1"
for db in "$SRC" "$SCRATCH"; do
  psql -U "$POSTGRES_USER" -d "$db" -Atc "$count_sql" | psql -U "$POSTGRES_USER" -d "$db" -At > "/tmp/counts_$db.txt" 2>/dev/null || true
done
# row counts for all tables in one pass using xml trick-free approach
for db in "$SRC" "$SCRATCH"; do
  psql -U "$POSTGRES_USER" -d "$db" -At -c "select string_agg(format('select %L as t, count(*) as c from public.%I', tablename, tablename), ' union all ' order by tablename) from pg_tables where schemaname='public'" > "/tmp/q_$db.sql"
  psql -U "$POSTGRES_USER" -d "$db" -At -f "/tmp/q_$db.sql" | sort > "/tmp/rows_$db.txt"
done
echo "tables in source: $(wc -l < /tmp/rows_$SRC.txt)  tables in restored copy: $(wc -l < /tmp/rows_$SCRATCH.txt)"
if diff -q "/tmp/rows_$SRC.txt" "/tmp/rows_$SCRATCH.txt" >/dev/null; then echo "ROW COUNTS: identical for every table"; else echo "ROW COUNTS: DIFFERENT"; diff "/tmp/rows_$SRC.txt" "/tmp/rows_$SCRATCH.txt" | head -20; fi
echo "total rows: $(awk -F'|' '{s+=$2} END {print s}' /tmp/rows_$SRC.txt)"

psql -U "$POSTGRES_USER" -d "$SCRATCH" -Atc "select 'flyway latest in copy: ' || max(version::int)::text from flyway_schema_history where version ~ '^[0-9]+$'" || true
psql -U "$POSTGRES_USER" -d "$SRC" -Atc "select 'flyway latest in source: ' || max(version::int)::text from flyway_schema_history where version ~ '^[0-9]+$'" || true

psql -U "$POSTGRES_USER" -d postgres -qc "drop database $SCRATCH"
rm -f "$OUT" /tmp/q_*.sql /tmp/rows_*.txt /tmp/counts_*.txt
echo "scratch database dropped"
