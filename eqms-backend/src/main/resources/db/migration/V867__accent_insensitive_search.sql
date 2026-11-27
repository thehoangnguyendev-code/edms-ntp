-- Search without case and without Vietnamese marks ("nguyen" finds "Nguyễn"), applied by the database so that paging and totals stay right.
-- Reading only: no stored value changes.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.eqms_fold(value text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, value)) $$;
