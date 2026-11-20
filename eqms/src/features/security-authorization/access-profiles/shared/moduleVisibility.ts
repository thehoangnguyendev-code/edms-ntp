/**
 * Record visibility of the modules that have two levels (VISIBILITY-TIERS-2026-11-20): Training Management (the department of the person, or every
 * department) and Reports (only the report runs the person started, or all). Each level is a set of permissions, so nothing is stored apart from the
 * Access Profile permissions: the picker only turns a choice into permissions and reads the choice back from them. Document Control has three levels
 * and its own file (documentControlVisibility.ts).
 */
export interface VisibilityLevelDef {
  value: string;
  label: string;
  description: string;
  /** The permissions that make this level (the base view permissions that open the pages are added too). Empty for the default level. */
  codes: readonly string[];
}

export interface ModuleVisibilityDef {
  key: "TRAINING" | "REPORTS";
  /** The module as the menu names it (the chip of the permission picker under which the choice is shown). */
  moduleName: string;
  title: string;
  description: string;
  /** The long explanation under "Details". */
  details: readonly { lead: string; text: string }[];
  /** Lowest first; a level includes the permissions of the levels below it. */
  levels: readonly VisibilityLevelDef[];
  /** Permissions that open the pages of the module; choosing a level above the default ticks them. */
  baseCodes: readonly string[];
  /** The level a profile has when it holds none of the level permissions; null when no level means no access to these records at all. */
  defaultLevel: string | null;
}

export const TRAINING_VISIBILITY: ModuleVisibilityDef = {
  key: "TRAINING",
  moduleName: "Training Management",
  title: "Which departments do the Training permissions apply to?",
  description: "A person with several profiles gets the highest level.",
  details: [
    { lead: "The department of the person:", text: "the default; it adds no permission. The trainings, matrices, records and people of the person's own Department." },
    { lead: "All departments:", text: "adds the permission \"Access Training of All Departments\" (training.scope.all); the Training permissions then apply to every Department." },
    { lead: "Several profiles:", text: "the highest level wins. A level that comes from a shared Permission Set is locked here: change it in the set." },
  ],
  levels: [
    {
      value: "DEPARTMENT",
      label: "The department of the person",
      description: "The default. The Training permissions apply to the trainings, matrices, records and people of the person's own Department.",
      codes: [],
    },
    {
      value: "ALL",
      label: "All departments",
      description: "The Training permissions apply to the data of every Department (the permission \"Access Training of All Departments\").",
      codes: ["training.scope.all"],
    },
  ],
  baseCodes: [],
  defaultLevel: "DEPARTMENT",
};

export const REPORTS_VISIBILITY: ModuleVisibilityDef = {
  key: "REPORTS",
  moduleName: "Reports",
  title: "Whose report runs can the people with this Access Profile see?",
  description: "A person with several profiles gets the highest level.",
  details: [
    { lead: "Only the runs the person started:", text: "the report history and the output files of the runs the person started." },
    { lead: "All report runs:", text: "adds the permission to view the runs of every user and their output files." },
    { lead: "Several profiles:", text: "the highest level wins. A level that comes from a shared Permission Set is locked here: change it in the set." },
  ],
  levels: [
    {
      value: "OWN",
      label: "Only the runs the person started",
      description: "The person sees the report runs they started and their output files.",
      codes: ["reports.run.view_own"],
    },
    {
      value: "ALL",
      label: "All report runs",
      description: "The person sees the report runs and the output files of every user.",
      codes: ["reports.run.view_own", "reports.run.view_all"],
    },
  ],
  baseCodes: ["report.module.view"],
  defaultLevel: null,
};

export const MODULE_VISIBILITY: readonly ModuleVisibilityDef[] = [TRAINING_VISIBILITY, REPORTS_VISIBILITY];

const normalise = (codes: Iterable<string>): Set<string> => new Set([...codes].map((code) => code.trim().toLowerCase()));

/** Every permission that decides a level of the module. */
export const levelCodesOf = (def: ModuleVisibilityDef): string[] => [...new Set(def.levels.flatMap((level) => level.codes))];

/** The highest level whose permissions are all held; the default level (or null) when none is. */
export const classifyModuleVisibility = (def: ModuleVisibilityDef, granted: Iterable<string>): string | null => {
  const held = normalise(granted);
  for (let i = def.levels.length - 1; i >= 0; i--) {
    const level = def.levels[i];
    if (level.codes.length > 0 && level.codes.every((code) => held.has(code))) return level.value;
  }
  return def.defaultLevel;
};

/** The index of a level in the ladder, -1 when the profile holds none. Used to tell which levels a shared set forbids lowering. */
export const levelRank = (def: ModuleVisibilityDef, value: string | null): number => def.levels.findIndex((level) => level.value === value);

/**
 * The direct permissions of a profile after the administrator chose a level: the permissions of the module's levels are taken off, then those of the
 * chosen level and the base view permissions are added. Permissions that come from a shared Permission Set (locked) are never touched.
 */
export const applyModuleVisibility = (
  def: ModuleVisibilityDef,
  direct: ReadonlySet<string>,
  locked: ReadonlySet<string>,
  choice: string,
): Set<string> => {
  const next = new Set(direct);
  for (const code of levelCodesOf(def)) if (!locked.has(code)) next.delete(code);
  const level = def.levels.find((l) => l.value === choice);
  if (!level) return next;
  const add = (code: string) => { if (!locked.has(code)) next.add(code); };
  level.codes.forEach(add);
  if (level.codes.length > 0) def.baseCodes.forEach(add);
  return next;
};
