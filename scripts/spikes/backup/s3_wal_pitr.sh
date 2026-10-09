#!/bin/bash
# S3 spike: WAL archiving and point-in-time recovery on PostgreSQL 17, using throw-away containers and volumes only.
# Nothing here touches the eqms-postgres container or its data.
set -e
IMG=postgres:17-alpine
docker rm -f spike-pg spike-pg2 >/dev/null 2>&1 || true
docker volume rm -f spike_arch spike_data1 spike_data2 >/dev/null 2>&1 || true
docker volume create spike_arch >/dev/null
docker volume create spike_data1 >/dev/null
docker volume create spike_data2 >/dev/null

# the archive volume must be writable by the postgres user (uid 70 in the alpine image)
docker run --rm -v spike_arch:/archive $IMG sh -c 'chown 70:70 /archive'

docker run -d --name spike-pg -e POSTGRES_PASSWORD=spike -v spike_data1:/var/lib/postgresql/data -v spike_arch:/archive $IMG \
  postgres -c wal_level=replica -c archive_mode=on -c "archive_command=test ! -f /archive/%f && cp %p /archive/%f" -c archive_timeout=30 >/dev/null
for i in $(seq 1 30); do docker exec spike-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done

q() { docker exec spike-pg psql -U postgres -Atc "$1"; }
q "create table t(id serial primary key, note text, at timestamptz default now())" >/dev/null
q "insert into t(note) select 'before-base-'||g from generate_series(1,1000) g" >/dev/null

echo "== base backup"
docker exec spike-pg sh -c 'mkdir -p /archive/base && pg_basebackup -U postgres -D /archive/base -Fp -X none -c fast && ls /archive/base | head -3'
q "insert into t(note) select 'after-base-'||g from generate_series(1,2000) g" >/dev/null
sleep 3
T=$(q "select to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI:SS.US')||'+00'")
echo "== target time: $T  (rows now: $(q 'select count(*) from t'))"
sleep 3
q "insert into t(note) select 'after-target-'||g from generate_series(1,3000) g" >/dev/null
q "select pg_switch_wal()" >/dev/null
sleep 5
echo "rows at the end: $(q 'select count(*) from t')   wal files archived: $(docker exec spike-pg sh -c 'ls /archive | grep -c "^0000"')"
docker stop spike-pg >/dev/null

echo "== restore to target time in a new container"
docker run --rm -v spike_arch:/archive -v spike_data2:/restore $IMG sh -c 'cp -a /archive/base/. /restore/ && chown -R 70:70 /restore && chmod 700 /restore'
docker run --rm -v spike_data2:/restore $IMG sh -c "
  touch /restore/recovery.signal
  echo \"restore_command = 'cp /archive/%f %p'\" >> /restore/postgresql.auto.conf
  echo \"recovery_target_time = '$T'\" >> /restore/postgresql.auto.conf
  echo \"recovery_target_action = 'promote'\" >> /restore/postgresql.auto.conf
  chown 70:70 /restore/postgresql.auto.conf /restore/recovery.signal"
docker run -d --name spike-pg2 -e POSTGRES_PASSWORD=spike -v spike_data2:/var/lib/postgresql/data -v spike_arch:/archive:ro $IMG >/dev/null
for i in $(seq 1 60); do docker exec spike-pg2 pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 3
R=$(docker exec spike-pg2 psql -U postgres -Atc "select count(*) from t")
M=$(docker exec spike-pg2 psql -U postgres -Atc "select count(*) from t where note like 'after-target-%'")
echo "rows after recovery: $R   rows written after the target time: $M"
if [ "$R" = "3000" ] && [ "$M" = "0" ]; then echo "PITR: PASS (exactly the rows up to the target time)"; else echo "PITR: FAIL"; docker logs spike-pg2 2>&1 | tail -15; fi

docker rm -f spike-pg spike-pg2 >/dev/null 2>&1
docker volume rm -f spike_arch spike_data1 spike_data2 >/dev/null 2>&1
echo "throw-away containers and volumes removed"
