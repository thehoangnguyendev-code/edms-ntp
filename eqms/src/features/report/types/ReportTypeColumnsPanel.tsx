import React from "react";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import type { ReportTypeDetail } from "@/services/api/reportTypes";

const TYPE_TEXT: Record<string, string> = { TEXT: "Text", DATE: "Date" };

/** The columns and filters of a Report Type, as the server declares them. Shown in the expanded row of the list and in the detail page. */
export const ReportTypeColumnsPanel: React.FC<{ detail: ReportTypeDetail }> = ({ detail }) => (
  <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
    <div className="min-w-0">
      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Columns ({detail.columns.length})</p>
      <div className="rounded-lg border border-slate-200 overflow-hidden inline-block max-w-full">
        <TableMarkup.Root className="text-xs table-auto w-auto">
          <TableMarkup.Head>
            <TableMarkup.Row className="bg-slate-100 border-b border-slate-200">
              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>Column</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>Code</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>Type</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.table9}>In every report</TableMarkup.HeaderCell>
            </TableMarkup.Row>
          </TableMarkup.Head>
          <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
            {detail.columns.map((column) => (
              <TableMarkup.Row key={column.code} className="hover:bg-slate-50 transition-colors">
                <TableMarkup.Cell className="py-1.5 px-2.5 font-medium text-emerald-700 whitespace-nowrap">{column.label}</TableMarkup.Cell>
                <TableMarkup.Cell className="py-1.5 px-2.5 whitespace-nowrap">
                  <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{column.code}</code>
                </TableMarkup.Cell>
                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">{TYPE_TEXT[column.type] ?? column.type}</TableMarkup.Cell>
                <TableMarkup.Cell className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">{column.required ? "Yes" : "No"}</TableMarkup.Cell>
              </TableMarkup.Row>
            ))}
          </TableMarkup.Body>
        </TableMarkup.Root>
      </div>
    </div>
    <div className="min-w-0">
      <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Filters ({detail.filters.length})</p>
      <ul className="space-y-1 text-xs text-slate-600">
        {detail.filters.map((filter) => (
          <li key={filter.code}>
            <span className="font-medium text-slate-700">{filter.label}</span> · {TYPE_TEXT[filter.type] ?? (filter.type === "LOOKUP" ? "List" : filter.type)}
          </li>
        ))}
      </ul>
    </div>
  </div>
);
