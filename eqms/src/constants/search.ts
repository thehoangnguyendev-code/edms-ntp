/**
 * How long a search text waits, after the last key, before the screen asks the server (one value for the whole project). A search is typed, not clicked: every key would
 * otherwise be a request. Filters, sort and paging are clicks and are not delayed.
 */
export const SEARCH_DEBOUNCE_MS = 300;
