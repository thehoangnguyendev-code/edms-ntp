-- Application Settings > Countries is now live-sourced from REST Countries v5
-- (https://restcountries.com) via RestCountriesClient/CountryManagementService -- no longer a
-- DB-managed dictionary. The countries table (and its former DictionaryManagementService CRUD
-- path) has no other table depending on it (Country was referenced only by its own repository);
-- Education > Schools stores country_of_origin_name/country_of_origin_iso2 as plain free-text
-- columns, not a foreign key to this table.
DROP TABLE IF EXISTS countries;
