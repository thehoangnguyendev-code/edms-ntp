-- V32: Normalize all employee_code values from EMP-XXXX format to NTP.XXXX format
-- Rules:
--   EMP-0001  → NTP.0001
--   EMP-1002  → NTP.1002
--   EMP-1004A → NTP.1004  (strip trailing non-numeric suffix)
-- Any code that does NOT match EMP- prefix is left unchanged.

UPDATE app_users
SET employee_code = 'NTP.' || LPAD(
    REGEXP_REPLACE(SUBSTRING(employee_code FROM 5), '[^0-9]', '', 'g'),
    4, '0'
)
WHERE employee_code LIKE 'EMP-%'
  AND REGEXP_REPLACE(SUBSTRING(employee_code FROM 5), '[^0-9]', '', 'g') != '';
