import React from "react";

import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import type { Reviewer } from "../tabs/subtabs";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

export const ReadOnlyReviewersTable: React.FC<{
  reviewers: Reviewer[];
  reviewRequirement?: "NONE" | "REQUIRED" | null;
}> = ({ reviewers, reviewRequirement }) => {
  if (reviewRequirement === "NONE") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
        Review is not required for this Document Type and Sub-Type.
      </div>
    );
  }
  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <TableMarkup.Root className="w-full">
          <TableMarkup.Head className="bg-slate-50 border-b border-slate-200">
            <TableMarkup.Row>
              <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell16}>
                No.
              </TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                User
              </TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell14}>
                Email
              </TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell13}>
                Position
              </TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell14}>
                Department
              </TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell12}>
                Sequence
              </TableMarkup.HeaderCell>
            </TableMarkup.Row>
          </TableMarkup.Head>
          <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
            {reviewers.length === 0 ? (
              <TableMarkup.Row>
                <TableMarkup.Cell colSpan={6} className="p-0">
                  <TableEmptyState title="No Reviewer assigned yet" />
                </TableMarkup.Cell>
              </TableMarkup.Row>
            ) : (
              reviewers
                .sort((a, b) => a.order - b.order)
                .map((reviewer, index) => (
                  <TableMarkup.Row
                    key={reviewer.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <TableMarkup.Cell className={TABLE_STYLES.cell18}>
                      {index + 1}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap">
                      <div>
                        <div className="font-medium text-slate-900">
                          {reviewer.fullName}
                        </div>
                        <div className="text-2xs text-slate-500">
                          {reviewer.username || reviewer.email}
                        </div>
                      </div>
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell8}>
                      {reviewer.email}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell7}>
                      {reviewer.position}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className={TABLE_STYLES.cell8}>
                      {reviewer.department}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                      <span className="inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-100 text-emerald-700 text-2xs font-bold">
                        {reviewer.order}
                      </span>
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                ))
            )}
          </TableMarkup.Body>
        </TableMarkup.Root>
      </div>
    </div>
  );
};

