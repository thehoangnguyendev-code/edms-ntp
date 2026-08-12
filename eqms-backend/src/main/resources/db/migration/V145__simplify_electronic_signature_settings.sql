-- Remove display-style configuration columns. Signature format is now fixed (GMP canonical block).
ALTER TABLE electronic_signature_settings
    DROP COLUMN IF EXISTS display_style,
    DROP COLUMN IF EXISTS show_full_name,
    DROP COLUMN IF EXISTS show_username,
    DROP COLUMN IF EXISTS show_position,
    DROP COLUMN IF EXISTS show_department,
    DROP COLUMN IF EXISTS show_meaning,
    DROP COLUMN IF EXISTS show_reason,
    DROP COLUMN IF EXISTS show_signed_date_time,
    DROP COLUMN IF EXISTS show_timezone,
    DROP COLUMN IF EXISTS show_electronically_signed_label,
    DROP COLUMN IF EXISTS show_signature_id,
    DROP COLUMN IF EXISTS show_status_icon,
    DROP COLUMN IF EXISTS show_email,
    DROP COLUMN IF EXISTS show_comment,
    DROP COLUMN IF EXISTS display_font_size_pt;
