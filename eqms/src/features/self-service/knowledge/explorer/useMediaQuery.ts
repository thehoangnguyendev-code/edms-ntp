import { useEffect, useState } from "react";

const supports = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** Tracks a CSS media query; false when the environment has no matchMedia (tests, SSR). */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => (supports() ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (!supports()) return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
};
