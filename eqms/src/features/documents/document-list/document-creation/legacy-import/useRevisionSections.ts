import { useState } from "react";
import { emptySection, MAX_BATCH_SECTIONS, type RevisionSection } from "./legacyImportModel";

/** The revision sections of the import (one for each historical revision) and what the person can do with them. */
export function useRevisionSections(revisionNumberSeed: "0.0.1" | "0.1") {
  const isTwoPartRevisionSeed = revisionNumberSeed === "0.1";
  const revisionNumberExample = isTwoPartRevisionSeed ? "4.0" : "4.0.0";
  const revisionNumberPattern = isTwoPartRevisionSeed
    ? /^\d+\.\d+$/
    : /^\d+\.\d+\.\d+$/;
  const isRevisionNumberFormatValid = (value: string) =>
    revisionNumberPattern.test(value.trim());
  const buildRevisionNumber = (major: number) =>
    isTwoPartRevisionSeed ? `${major}.0` : `${major}.0.0`;

  const [targetRevisionNumber, setTargetRevisionNumber] = useState("");
  const [sections, setSections] = useState<RevisionSection[]>([]);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);

  const generateSections = () => {
    const trimmed = targetRevisionNumber.trim();
    if (!isRevisionNumberFormatValid(trimmed)) return;
    const major = parseInt(trimmed.split(".")[0], 10);
    if (!Number.isFinite(major) || major < 1) return;
    const count = Math.min(major, MAX_BATCH_SECTIONS);
    const next: RevisionSection[] = [];
    for (let i = 1; i <= count; i++) {
      const section = emptySection(buildRevisionNumber(i));
      // Only the first (oldest) revision starts expanded -- the rest stay collapsed regardless of
      // batch size, and the user opens whichever ones they need next themselves.
      section.collapsed = count > 1 && i !== 1;
      next.push(section);
    }
    setSections(next);
    setBulkConfirmed(false);
  };

  const updateSection = <K extends keyof RevisionSection>(
    key: string,
    field: K,
    value: RevisionSection[K],
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)),
    );
  };

  const toggleCollapsed = (key: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, collapsed: !s.collapsed } : s)),
    );
  };

  // Copies the first section's Author/Historical Reviewer(s)/Historical Approver onto every other
  // section -- a convenience for large batches, not a lock: every section (the first one included)
  // stays freely editable afterward, and re-clicking after changing the first section's values
  // re-applies the new ones.
  const applyFirstSectionRolesToRest = () => {
    setSections((prev) => {
      const first = prev[0];
      if (!first) return prev;
      return prev.map((s, i) =>
        i === 0
          ? s
          : {
              ...s,
              authorId: first.authorId,
              legacyHistoricalReviewerIds: [...first.legacyHistoricalReviewerIds],
              legacyHistoricalApproverId: first.legacyHistoricalApproverId,
            },
      );
    });
  };

  return {
    sections,
    setSections,
    targetRevisionNumber,
    setTargetRevisionNumber,
    bulkConfirmed,
    setBulkConfirmed,
    isTwoPartRevisionSeed,
    revisionNumberExample,
    isRevisionNumberFormatValid,
    generateSections,
    updateSection,
    toggleCollapsed,
    applyFirstSectionRolesToRest,
  };
}
