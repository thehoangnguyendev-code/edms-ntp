import { moduleDisplayName } from "@/utils/moduleDisplay";

/** A module key as the screen shows it: the name of its menu ("documents" is "Document Control"). Display only; the key itself is what the server filters on. */
export const moduleLabel = (key?: string | null): string => moduleDisplayName(key);
