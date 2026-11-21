import { useEffect, useState } from "react";

/** Tracks a CSS media query. Starts from the current match so the first render is already correct. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
