import { api } from "./client";
import type { CountryItem, CountryListParams } from "@/features/settings/countries/types";

type PageResponse<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

/** Backend CountryDictionaryResponse -- no top-level id anymore (iso2Code is the stable key). */
type ApiCountry = Omit<CountryItem, "id">;

const mapCountry = (item: ApiCountry): CountryItem => ({
  id: item.iso2Code || item.name,
  name: item.name,
  officialName: item.officialName ?? "",
  iso2Code: item.iso2Code ?? "",
  iso3Code: item.iso3Code ?? "",
  region: item.region ?? "",
  subregion: item.subregion ?? "",
  capital: item.capital ?? "",
  flagUrl: item.flagUrl ?? "",
  dialCode: item.dialCode ?? "",
  continent: item.continent ?? "",
  ianaSuffix: item.ianaSuffix ?? "",
  population: item.population ?? undefined,
  area: item.area ?? undefined,
});

/** Countries owns its API contract; it is deliberately independent from Dictionaries.
 *  Live-sourced from REST Countries v5 via the backend (RestCountriesClient/
 *  CountryManagementService) -- read-only, no create/update/delete. */
export const countriesApi = {
  list: async (): Promise<CountryItem[]> => (await api.get<ApiCountry[]>("/settings/countries")).data.map(mapCountry),
  page: async (params: CountryListParams): Promise<PageResponse<CountryItem>> => {
    const response = await api.get<PageResponse<ApiCountry>>("/settings/countries/page", { params });
    return { data: response.data.data.map(mapCountry), pagination: response.data.pagination };
  },
  filterOptions: async (): Promise<{ regions: string[] }> => (await api.get<{ regions: string[] }>("/settings/countries/filter-options")).data,
  /** Admin-only cache-bust (settings.country.manage) -- pulls the latest data before the backend's
   *  12h TTL expires on its own. */
  refresh: async (): Promise<void> => { await api.post("/settings/countries/refresh"); },
};
