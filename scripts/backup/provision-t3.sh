#!/usr/bin/env bash
# Creates the DEV T3 bucket (Object Lock, GOVERNANCE, 1 day) on the second MinIO. Safe to run twice: an existing bucket is left alone.
# Needs: the stack started with --profile backup-t3 and the agent image built. Reads .env for the T3 credentials.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
BUCKET="${BACKUP_T3_BUCKET:-eqms-dev-backup-t3}"
case "${EQMS_ENVIRONMENT:-DEV}" in
  PROD) echo "Refusing: GOVERNANCE retention is for DEV and TEST. Provision PROD with COMPLIANCE by hand." >&2; exit 1 ;;
esac
MSYS_NO_PATHCONV=1 docker compose -f docker-compose.yml -f docker-compose.backup-t3.yml --profile backup-t3 run --rm --no-deps \
  --entrypoint java backup-agent \
  -cp /app/eqms-backup-agent.jar -Dloader.main=com.eqms.backup.agent.target.ObjectLockBucketProvisioner \
  org.springframework.boot.loader.launch.PropertiesLauncher \
  http://backup-target-t3:9000 "${BACKUP_T3_MINIO_USER:-eqms-t3}" "${BACKUP_T3_MINIO_PASSWORD}" "$BUCKET" GOVERNANCE 1 || {
  echo "Bucket not created (it may already exist)."; exit 0; }
