import { useEffect, useRef, useState } from 'react';
import { searchApi, type GlobalSearchGroup } from '@/services/api/search';
import { SEARCH_DEBOUNCE_MS } from '@/constants/search';
import { useDebounce } from '@/hooks/useDebounce';
import { MIN_GLOBAL_SEARCH_LENGTH } from './globalSearchModel';

/** An answer is reused for this long when the same words are typed again (backspace, retyping), so those keys cost no request. */
const CACHE_TTL_MS = 20_000;
const CACHE_MAX_ENTRIES = 30;

export interface GlobalSearchState {
  groups: GlobalSearchGroup[];
  /** An answer is on its way: the last one stays on screen until it arrives. */
  loading: boolean;
  /** The words are long enough to search and the server has answered them (an empty list then really is "no results"). */
  answered: boolean;
  failed: boolean;
}

/**
 * The search of the top bar: waits for a pause in the typing, asks the server once, drops the request that a newer key has replaced, and remembers the
 * last answers for a short while. Nothing is decided here about what a person may see; the server answers only with what they may open.
 */
export function useGlobalSearch(query: string, enabled: boolean): GlobalSearchState {
  const words = query.trim();
  const debounced = useDebounce(words, SEARCH_DEBOUNCE_MS);
  const [state, setState] = useState<GlobalSearchState>({ groups: [], loading: false, answered: false, failed: false });
  const cache = useRef(new Map<string, { at: number; groups: GlobalSearchGroup[] }>());

  useEffect(() => {
    if (!enabled || debounced.length < MIN_GLOBAL_SEARCH_LENGTH) {
      setState({ groups: [], loading: false, answered: false, failed: false });
      return undefined;
    }
    const key = debounced.toLowerCase();
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      setState({ groups: hit.groups, loading: false, answered: true, failed: false });
      return undefined;
    }

    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, failed: false }));
    searchApi.globalSearch(debounced, controller.signal)
      .then((answer) => {
        if (controller.signal.aborted) return;
        // Only complete answers are kept: a kind that was late would otherwise stay "unavailable" for the whole time of the cache.
        if (answer.groups.every((group) => !group.unavailable)) {
          cache.current.delete(key);
          cache.current.set(key, { at: Date.now(), groups: answer.groups });
          while (cache.current.size > CACHE_MAX_ENTRIES) {
            const oldest = cache.current.keys().next().value;
            if (oldest === undefined) break;
            cache.current.delete(oldest);
          }
        }
        setState({ groups: answer.groups, loading: false, answered: true, failed: false });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, loading: false, failed: true }));
      });
    return () => controller.abort();
  }, [debounced, enabled]);

  // Between the key and the end of the pause the old answer stays, marked as on its way, so the list does not flash empty.
  const typing = enabled && words !== debounced && words.length >= MIN_GLOBAL_SEARCH_LENGTH;
  return { ...state, loading: state.loading || typing };
}
