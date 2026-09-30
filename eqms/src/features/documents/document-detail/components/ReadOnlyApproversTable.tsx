import React from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Approver } from "../tabs/subtabs";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

export const ReadOnlyApproversTable: React.FC<{ approvers: Approver[] }> = ({
  approvers,
}) => {
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
                Role
              </TableMarkup.HeaderCell>
            </TableMarkup.Row>
          </TableMarkup.Head>
          <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
            {approvers.length === 0 ? (
              <TableMarkup.Row>
                <TableMarkup.Cell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                      <Search className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      No records to display
                    </p>
                  </div>
                </TableMarkup.Cell>
              </TableMarkup.Row>
            ) : (
              approvers.map((approver, index) => (
                <TableMarkup.Row
                  key={approver.id}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-500 whitespace-nowrap">
                    {index + 1}
                  </TableMarkup.Cell>
                  <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                    <div>
                      <div className="font-medium text-slate-900">
                        {approver.fullName}
                      </div>
                      <div className="text-2xs text-slate-500">
                        {approver.username || approver.email}
                      </div>
                    </div>
                  </TableMarkup.Cell>
                  <TableMarkup.Cell className={TABLE_STYLES.cell8}>
                    {approver.email}
                  </TableMarkup.Cell>
                  <TableMarkup.Cell className={TABLE_STYLES.cell7}>
                    {approver.position}
                  </TableMarkup.Cell>
                  <TableMarkup.Cell className={TABLE_STYLES.cell8}>
                    {approver.department}
                  </TableMarkup.Cell>
                  <TableMarkup.Cell className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                    <Badge color="emerald" size="sm">
                      Approver
                    </Badge>
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
