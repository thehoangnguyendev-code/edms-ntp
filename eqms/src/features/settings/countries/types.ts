/** Live-sourced from REST Countries v5 (https://restcountries.com/docs/countries) via the
 *  backend proxy/cache (RestCountriesClient/CountryManagementService) -- read-only, no local
 *  Active/Inactive/created/modified concept. iso2Code is the stable key (used as `id`). */
export interface CountryItem {
  id: string;
  name: string;
  officialName?: string;
  iso2Code?: string;
  iso3Code?: string;
  region?: string;
  subregion?: string;
  capital?: string;
  flagUrl?: string;
  dialCode?: string;
  continent?: string;
  /** ccTLD, e.g. ".vn". */
  ianaSuffix?: string;
  population?: number;
  area?: number;
}

export type CountryListParams = {
  search?: string;
  region?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};
