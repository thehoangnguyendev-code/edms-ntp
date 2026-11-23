import React, { useMemo } from "react";
import { VisibilityBox, DetailList } from "./VisibilityBox";
import { VisibilityOptions, type VisibilityOption } from "@/components/ui/radio/VisibilityOptions";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import {
  DOCUMENT_CONTROL_VIEW_ALL_CODES,
  DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE,
  DOCUMENT_CONTROL_VISIBILITY_ORDER,
  classifyVisibility,
  missingViewAllCodes,
  type DocumentControlVisibilityChoice,
} from "./documentControlVisibility";
import { tr, trFormat } from "@/i18n";

const OPTION_TEXT: Record<DocumentControlVisibilityChoice, { label: string; description: string }> = {
  NAMED_IN_FLOW: {
    label: tr("Only records where the person is named"),
    description: tr("The default. Documents and Revisions where the person is named in the flow, and the copies of those revisions."),
  },
  DEPARTMENT: {
    label: tr("Records of the person's department"),
    description: tr("Adds every Document and Revision of the person's own Department, drafts included (read-only)."),
  },
  VIEW_EVERYTHING: {
    label: tr("All records"),
    description: tr("Every Document, Revision and Copy of every department, drafts included (read-only)."),
  },
};

const DETAILS = [
  { lead: "Who is \"named\":", text: "the author, co-author, reviewer, approver or creator of the revision, and the people who receive a copy." },
  { lead: "Copies:", text: "a person named in the flow of a revision sees the copy record; the content (issued PDF, evidence, preview) stays with the recipient and with \"All records\". Download and print follow the Controlled Copies Policy." },
  { lead: "Department:", text: "the Department written on the Document, compared with the person's own Department. Drafts are included, review snapshots in progress are not opened." },
  { lead: "Read-only:", text: "seeing a record does not allow acting on it; acting still needs a name in the flow and the permission of the step." },
  { lead: "A revision the person left:", text: "a person who was named on an older revision still sees that revision, and does not see a newer one where they are no longer named." },
  { lead: "Several profiles:", text: "the highest level wins. A level that comes from a shared Permission Set is locked here: change it in the set." },
];

const LEVEL_CODES: readonly string[] = [...DOCUMENT_CONTROL_VIEW_ALL_CODES, DOCUMENT_CONTROL_VIEW_DEPARTMENT_CODE];

/**
 * Chooses how much of Document Control the people with an Access Profile can see (VISIBILITY-TIERS-2026-11-20): only what has their name in the
 * flow, the records of their department, or all. The choice is written as permissions; nothing is stored elsewhere. A level that comes from a
 * shared Permission Set can only be lowered by taking the set off.
 */
export const DocumentControlVisibilityPicker: React.FC<{
  /** Everything the profile grants: its own permissions and those of its shared sets. */
  selectedCodes: ReadonlySet<string>;
  /** The permissions that come from a shared Permission Set. */
  lockedCodes: ReadonlySet<string>;
  /** The set that grants each locked permission (shown as the reason a level cannot be lowered). */
  lockedNotes?: ReadonlyMap<string, string>;
  disabled?: boolean;
  onChoose: (choice: DocumentControlVisibilityChoice) => void;
  className?: string;
}> = ({ selectedCodes, lockedCodes, lockedNotes, disabled = false, onChoose, className }) => {
  const current = useMemo(() => classifyVisibility(selectedCodes), [selectedCodes]);
  const floor = useMemo(() => classifyVisibility(lockedCodes), [lockedCodes]);
  const incomplete = current === "INCOMPLETE";
  const missing = useMemo(() => missingViewAllCodes(selectedCodes), [selectedCodes]);
  const floorRank = floor === "INCOMPLETE" ? DOCUMENT_CONTROL_VISIBILITY_ORDER.indexOf("DEPARTMENT") : DOCUMENT_CONTROL_VISIBILITY_ORDER.indexOf(floor as DocumentControlVisibilityChoice);

  const grantedBy = useMemo(() => {
    const sets = new Set<string>();
    for (const code of LEVEL_CODES) {
      if (!lockedCodes.has(code)) continue;
      const note = lockedNotes?.get(code);
      if (note) sets.add(note.replace(/^Granted by shared set: /, ""));
    }
    return [...sets].join(", ");
  }, [lockedCodes, lockedNotes]);

  const options: VisibilityOption[] = DOCUMENT_CONTROL_VISIBILITY_ORDER.map((choice, rank) => ({
    value: choice,
    label: OPTION_TEXT[choice].label,
    description: OPTION_TEXT[choice].description,
    disabled: rank < floorRank,
  }));

  return (
    <VisibilityBox
      title={tr("Which Document Control records can the people with this Access Profile see?")}
      description={tr("A person with several profiles gets the highest level.")}
      testId="record-visibility-picker"
      details={<DetailList items={DETAILS} />}
      className={className}
    >
      <>
        <VisibilityOptions
          name="document-control-visibility"
          value={incomplete ? "" : current}
          onChange={(value) => onChoose(value as DocumentControlVisibilityChoice)}
          options={options}
          disabled={disabled}
        />
        {incomplete && (
          <WarningBanner
            variant="warning"
            description={
              <>
                {tr("This profile grants only part of")} <b>{tr("All records")}</b> {tr("(missing:")} {missing.join(", ")}{tr("), so its people see everything of one kind and only what has their name for the others. Choose a level above to correct it.")}
              </>
            }
          />
        )}
        {floorRank > 0 && grantedBy && (
          <p className="text-xs text-slate-500">
            {trFormat("Part of this level is granted by the shared Permission Set {set}. To give the profile a lower level, take that set off the profile.", { set: grantedBy })}
          </p>
        )}
      </>
    </VisibilityBox>
  );
};
