-- Telegram/WhatsApp channel integration (planned for NOTIFICATION_SYSTEM_REMEDIATION_PLAN.md
-- Phase 5/6) was cancelled by the user before any Telegram/WhatsApp code was written. V370 added
-- these columns in preparation; nothing in the codebase ever read or wrote them (no entity field
-- mapping, no adapter, no FE field) so this is a clean drop.
ALTER TABLE app_users DROP COLUMN IF EXISTS telegram_chat_id;
ALTER TABLE app_users DROP COLUMN IF EXISTS telegram_link_token;
ALTER TABLE app_users DROP COLUMN IF EXISTS telegram_link_expires_at;
ALTER TABLE app_users DROP COLUMN IF EXISTS whatsapp_phone_number;
ALTER TABLE app_users DROP COLUMN IF EXISTS whatsapp_verified_at;
