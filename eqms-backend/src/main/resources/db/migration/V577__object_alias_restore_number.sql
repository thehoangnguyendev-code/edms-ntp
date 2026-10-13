-- The restore request number is called Restore Number everywhere (SDS 11.3). Only the column name changes.
ALTER TABLE object_version_alias RENAME COLUMN restore_request_id TO restore_number;
