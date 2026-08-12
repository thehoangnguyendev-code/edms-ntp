-- V33: Standardize all employee_code values to sequential NTP.XXXX format
WITH ordered_users AS (
    SELECT id, username,
           row_number() OVER (
               ORDER BY 
                   CASE 
                       WHEN username = 'admin' THEN 0
                       WHEN employee_code LIKE 'EMP-10%' OR employee_code LIKE 'NTP.10%' THEN 
                            CAST(REGEXP_REPLACE(SUBSTRING(employee_code FROM 5), '[^0-9]', '', 'g') AS INTEGER) - 1000
                       ELSE 9999
                   END,
                   created_at,
                   id
           ) as seq_num
    FROM app_users
)
UPDATE app_users
SET employee_code = 'NTP.' || LPAD(ordered_users.seq_num::text, 4, '0')
FROM ordered_users
WHERE app_users.id = ordered_users.id;
