import React from "react";
import { motion } from "framer-motion";
import { EXPAND_CONTENT_MOTION, useExpandTransition } from "@/components/ui/table/expandMotion";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import type { ReportNameFormatListItem } from "@/services/api/reportNameFormats";

interface ExpandedReportNameFormatRowProps {
  format: ReportNameFormatListItem;
  isExpanded: boolean;
  visibleColumnsLength: number;
}

const RULE_TEXT: Record<string, string> = {
  TEXT: "Text",
  UPPER_CODE: "Upper-case code",
  DIGITS: "Digits only",
};

/**
 * Expanded row for a Report Name Format: the ordered parts that make the name of a template (No. / Type / Text or Label / Rule / Longest),
 * with the same layout, animation and nested-table style as the expanded row of a Document Name Format.
 */
export const ExpandedReportNameFormatRow: React.FC<ExpandedReportNameFormatRowProps> = ({ format, isExpanded, visibleColumnsLength }) => {
  const transitionConfig = useExpandTransition();
  const parts = format.parts ?? [];

  return (
    <>
      {isExpanded && (
        <motion.tr
          key={`expanded-report-name-format-${format.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="bg-slate-50/50"
        >
          <TableMarkup.Cell colSpan={visibleColumnsLength - 1} className="p-0 border-b border-slate-200">
            <motion.div {...EXPAND_CONTENT_MOTION} transition={transitionConfig} className="overflow-hidden">
              <div className="p-4 md:p-5">
                <div className="ml-9 flex flex-col gap-4 items-start">
                  {parts.length > 0 ? (
                    <div className="w-full">
                      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Name Parts ({parts.length})</p>
                      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
                        <TableMarkup.Root className="text-xs table-auto w-auto">
                          <TableMarkup.Head>
                            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>Type</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>Text / Label</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>Rule</TableMarkup.HeaderCell>
                              <TableMarkup.HeaderCell className="py-1.5 px-2.5 text-right text-2xs md:text-xs font-semibold text-slate-600 whitespace-nowrap">Order</TableMarkup.HeaderCell>
                            </TableMarkup.Row>
                          </TableMarkup.Head>
                          <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                            {parts.map((part, index) => (
                              <TableMarkup.Row key={index} className="hover:bg-slate-50 transition-colors">
                                <TableMarkup.Cell className="py-1.5 px-2.5 font-medium text-emerald-700 whitespace-nowrap">
                                  {part.type === "FIXED" ? "Fixed text" : "Typed for each template"}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{part.type === "FIXED" ? part.fixedText : `<${part.inputLabel}>`}</code>
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className={TABLE_STYLES.table10}>
                                  {part.type === "INPUT" ? `${RULE_TEXT[part.inputRule ?? "TEXT"] ?? part.inputRule}, up to ${part.maxLength} characters` : "-"}
                                </TableMarkup.Cell>
                                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 text-right whitespace-nowrap">{(index + 1) * 10}</TableMarkup.Cell>
                              </TableMarkup.Row>
                            ))}
                          </TableMarkup.Body>
                        </TableMarkup.Root>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Version v{format.version}. A template that already has a name keeps it when this format changes.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-2">This format has no parts configured.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </TableMarkup.Cell>
          <TableMarkup.Cell className={TABLE_STYLES.emptyCell1}></TableMarkup.Cell>
        </motion.tr>
      )}
    </>
  );
};
