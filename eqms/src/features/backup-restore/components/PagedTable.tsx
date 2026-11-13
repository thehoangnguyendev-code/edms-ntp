import React from "react";
import { DataTable, TablePagination, type DataTableProps } from "@/components/ui/table";

type Paging = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
};

/** A table whose pagination sits inside its frame, as in every list of the application. Paging itself is done by the server. */
export function PagedTable<T>({ paging, ...table }: DataTableProps<T> & { paging: Paging }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <DataTable
        {...table}
        pagination={
          paging.totalItems > 0 ? (
            <div className="border-t border-slate-200">
              <TablePagination
                currentPage={paging.page}
                totalPages={paging.totalPages}
                totalItems={paging.totalItems}
                itemsPerPage={paging.pageSize}
                onPageChange={paging.onPageChange}
                onItemsPerPageChange={paging.onPageSizeChange}
                itemsPerPageOptions={paging.pageSizeOptions ?? [5, 10, 20]}
              />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
