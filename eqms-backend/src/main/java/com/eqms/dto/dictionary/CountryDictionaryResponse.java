package com.eqms.dto.dictionary;

/** Sourced live from REST Countries v5 (https://restcountries.com) via RestCountriesClient -- not
 *  a DB-managed dictionary anymore. No id/isActive/createdDate/modifiedDate: iso2Code is the
 *  stable key, and there is no local Active/Inactive concept for third-party reference data. */
public record CountryDictionaryResponse(
        String iso2Code,
        String name,
        String officialName,
        String iso3Code,
        String region,
        String subregion,
        String capital,
        String flagUrl,
        String dialCode,
        String continent,
        String ianaSuffix,
        Long population,
        Double area
) {
}
