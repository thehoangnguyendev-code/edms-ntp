#!/usr/bin/env bash
# Creates the ONE Super Administrator account (SDS-BR-001 section 11.6, decision BR-17) in the backup control database. It is kept
# outside the eQMS user table. The account is created here, by an operator, and cannot be created over HTTP.
# The password is read from the environment, never shown or stored. DEV only in this form: TEST and PROD are provisioned by the
# people who hold the account.
#   SUPER_ADMIN_USERNAME=super.admin SUPER_ADMIN_PASSWORD='...' bash scripts/backup/provision-super-admin.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
[ "${EQMS_ENVIRONMENT:-DEV}" = "DEV" ] || { echo "DEV only in this form"; exit 2; }
: "${SUPER_ADMIN_USERNAME:?set SUPER_ADMIN_USERNAME}"
: "${SUPER_ADMIN_PASSWORD:?set SUPER_ADMIN_PASSWORD}"
export SUPER_ADMIN_USERNAME SUPER_ADMIN_PASSWORD
MSYS_NO_PATHCONV=1 docker compose -f docker-compose.yml -f docker-compose.backup-t3.yml -f docker-compose.backup-restore.yml --profile backup-t3 --profile restore-worker \
  run --rm --no-deps -e SUPER_ADMIN_USERNAME -e SUPER_ADMIN_PASSWORD \
  --entrypoint java backup-agent \
  -cp /app/eqms-backup-agent.jar -Dloader.main=com.eqms.backup.agent.maintenance.SuperAdminProvisioner \
  org.springframework.boot.loader.launch.PropertiesLauncher
