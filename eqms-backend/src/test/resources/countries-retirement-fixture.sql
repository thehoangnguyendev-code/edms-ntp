-- TEMP tables shadow real application tables; the entire fixture rolls back.
BEGIN;
CREATE TEMP TABLE countries (name text);
CREATE TEMP TABLE schools (country_of_origin_name text, country_of_origin_iso2 text);
INSERT INTO schools VALUES ('Vietnam', 'VN');
CREATE TEMP TABLE audit_trails (details text);
INSERT INTO audit_trails VALUES ('Countries historical change');
CREATE TEMP TABLE permissions (id uuid PRIMARY KEY, code text UNIQUE);
INSERT INTO permissions VALUES
 ('00000000-0000-0000-0000-000000000001', 'settings.country.view'),
 ('00000000-0000-0000-0000-000000000002', 'settings.country.manage'),
 ('00000000-0000-0000-0000-000000000003', 'settings.education.school.view');
CREATE TEMP TABLE permission_dependencies (
 permission_code text REFERENCES permissions(code), depends_on_code text REFERENCES permissions(code));
INSERT INTO permission_dependencies VALUES ('settings.country.manage', 'settings.country.view');
CREATE TEMP TABLE permission_set_items (permission_id uuid REFERENCES permissions(id));
INSERT INTO permission_set_items SELECT id FROM permissions;
