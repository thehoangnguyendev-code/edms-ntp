import React from "react";
import { Search } from "lucide-react";
import type { Reviewer } from "../tabs/subtabs";

export const ReadOnlyReviewersTable: React.FC<{ reviewers: Reviewer[] }> = ({
  reviewers,
}) => {
  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">
                No.
              </th>
              <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                User
              </th>
              <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                Email
              </th>
              <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                Position
              </th>
              <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                Department
              </th>
              <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Sequence
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {reviewers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                      <Search className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">
                      No records to display
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              reviewers
                .sort((a, b) => a.order - b.order)
                .map((reviewer, index) => (
                  <tr
                    key={reviewer.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm text-slate-500 whitespace-nowrap">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap">
                      <div>
                        <div className="font-medium text-slate-900">
                          {reviewer.fullName}
                        </div>
                        <div className="text-2xs text-slate-500">
                          {reviewer.username || reviewer.email}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden md:table-cell">
                      {reviewer.email}
                    </td>
                    <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden lg:table-cell">
                      {reviewer.position}
                    </td>
                    <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden md:table-cell">
                      {reviewer.department}
                    </td>
                    <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                      <span className="inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-100 text-emerald-700 text-2xs font-bold">
                        {reviewer.order}
                      </span>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

