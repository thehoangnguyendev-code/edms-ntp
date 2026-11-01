import React from "react";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { cn } from "@/components/ui/utils";
import { CONFIRM_THRESHOLD, FIELD_HINT, FIELD_INPUT, FIELD_LABEL } from "./legacyImportModel";
import { RevisionSectionCard, type RevisionSectionCardProps } from "./RevisionSectionCard";

type SectionCardShared = Omit<RevisionSectionCardProps, "section" | "index" | "sectionCount">;

export interface RevisionHistoryTabProps extends SectionCardShared {
  sections: RevisionSectionCardProps["section"][];
  targetRevisionNumber: string;
  setTargetRevisionNumber: (value: string) => void;
  revisionNumberExample: string;
  isTwoPartRevisionSeed: boolean;
  generateSections: () => void;
  bulkConfirmed: boolean;
  setBulkConfirmed: (value: boolean) => void;
}

/** Tab "Revision History": the most recent revision number, and one card for each historical revision that it generates. */
export const RevisionHistoryTab: React.FC<RevisionHistoryTabProps> = ({
  sections,
  targetRevisionNumber,
  setTargetRevisionNumber,
  revisionNumberExample,
  isTwoPartRevisionSeed,
  generateSections,
  bulkConfirmed,
  setBulkConfirmed,
  isRevisionNumberFormatValid,
  ...card
}) => (
  <div className="space-y-4 md:space-y-5">
    <div>
      <label className={FIELD_LABEL}>
        Most Recent Revision Number
        <span className="text-red-500 ml-1">*</span>
      </label>
      <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          className={cn(
            FIELD_INPUT,
            "flex-1 min-w-0",
            targetRevisionNumber.trim() &&
              !isRevisionNumberFormatValid(targetRevisionNumber) &&
              "border-red-400 focus:ring-red-400 focus:border-red-400",
          )}
          value={targetRevisionNumber}
          onChange={(e) => setTargetRevisionNumber(e.target.value)}
          placeholder={`e.g. ${revisionNumberExample}`}
        />
        <Button
          type="button"
          variant="default"
          size="sm"
          className="whitespace-nowrap shrink-0"
          onClick={generateSections}
          disabled={!isRevisionNumberFormatValid(targetRevisionNumber)}
        >
          {sections.length > 0
            ? "Regenerate Sections"
            : "Generate Sections"}
        </Button>
      </div>
      <p className={FIELD_HINT}>
        Default Revision Number Format is set
        to {isTwoPartRevisionSeed ? "X.Y" : "X.Y.Z"} in System Administration &gt; Document Administration &gt;
        Document Properties.
      </p>
    </div>

    {sections.length > CONFIRM_THRESHOLD && (
      <WarningBanner
        variant="warning"
        title={`This will create ${sections.length} revisions`}
        description="Double-check the Revision Number is correct before continuing."
      />
    )}

    <div className="space-y-3">
      {sections.map((section, index) => (
        <RevisionSectionCard
          key={section.key}
          section={section}
          index={index}
          sectionCount={sections.length}
          isRevisionNumberFormatValid={isRevisionNumberFormatValid}
          {...card}
        />
      ))}
    </div>

    {sections.length === 0 && (
      <p className="text-sm text-slate-500 text-center py-6">
        No revision sections yet — enter a Revision Number above and click
        "Generate Sections".
      </p>
    )}

    {sections.length > CONFIRM_THRESHOLD && (
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={bulkConfirmed}
          onChange={(e) => setBulkConfirmed(e.target.checked)}
        />
        <span>
          I confirm I want to create {sections.length} revisions for this
          document.
        </span>
      </label>
    )}
  </div>
);
