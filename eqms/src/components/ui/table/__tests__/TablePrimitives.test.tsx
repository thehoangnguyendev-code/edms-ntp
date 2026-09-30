import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TableMarkup } from "../TablePrimitives";
import { DataTable } from "../DataTable";

describe("shared table DOM contract", () => {
  it("preserves refs, merged cells, native attributes and editable controls without DOM wrappers", () => {
    const tableRef = React.createRef<HTMLTableElement>();
    const cellRef = React.createRef<HTMLTableCellElement>();
    const change = vi.fn();
    const { container } = render(
      <TableMarkup.Root ref={tableRef} className="matrix" aria-label="Qualifications">
        <TableMarkup.Caption>Employee qualifications</TableMarkup.Caption>
        <TableMarkup.ColumnGroup><TableMarkup.Column span={2} /></TableMarkup.ColumnGroup>
        <TableMarkup.Head><TableMarkup.Row><TableMarkup.HeaderCell scope="col" colSpan={2}>Qualification</TableMarkup.HeaderCell></TableMarkup.Row></TableMarkup.Head>
        <TableMarkup.Body>
          <TableMarkup.Row data-record-id="42"><TableMarkup.Cell ref={cellRef} rowSpan={2}><input aria-label="Result" onChange={change} /></TableMarkup.Cell><TableMarkup.Cell>Status</TableMarkup.Cell></TableMarkup.Row>
          <TableMarkup.Row><TableMarkup.Cell>Review</TableMarkup.Cell></TableMarkup.Row>
        </TableMarkup.Body>
        <TableMarkup.Foot><TableMarkup.Row><TableMarkup.Cell colSpan={2}>Total</TableMarkup.Cell></TableMarkup.Row></TableMarkup.Foot>
      </TableMarkup.Root>,
    );
    expect(tableRef.current?.tagName).toBe("TABLE");
    expect(tableRef.current?.className).toBe("matrix");
    expect(cellRef.current?.rowSpan).toBe(2);
    expect(container.querySelector("th")?.colSpan).toBe(2);
    expect(container.querySelector("tbody > tr")?.getAttribute("data-record-id")).toBe("42");
    expect([...tableRef.current!.children].map(element => element.tagName)).toEqual(["CAPTION", "COLGROUP", "THEAD", "TBODY", "TFOOT"]);
    fireEvent.change(screen.getByRole("textbox", { name: "Result" }), {target: {value:"Pass"}});
    expect(change).toHaveBeenCalledOnce();
  });

  it("preserves row actions, selection and sticky action event isolation", () => {
    const clickRow = vi.fn();
    const action = vi.fn();
    const sort = vi.fn();
    const { container } = render(
      <DataTable
        rows={[{id:"record-1", name:"Document"}]}
        getRowKey={row => row.id}
        columns={[{id:"name", header:"Name", cell: row => row.name, sort:{direction:"asc", onSort:sort}}]}
        selection={{visible:true, cell: () => <input type="checkbox" aria-label="Select record" />}}
        onRowClick={clickRow}
        action={{cell: () => <button onClick={action}>Approve</button>}}
        pagination={<div>Page 1</div>}
      />,
    );
    fireEvent.click(screen.getByRole("columnheader", {name:"Name"}));
    expect(sort).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Document"));
    expect(clickRow).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", {name:"Approve"}));
    expect(action).toHaveBeenCalledOnce();
    expect(clickRow).toHaveBeenCalledOnce();
    expect(container.querySelector("tbody tr")?.children).toHaveLength(3);
    expect(container.querySelector("tbody tr td:last-child")?.className).toContain("sticky right-0");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("calculates empty-state colspan when optional columns are present and hides pagination", () => {
    const {container} = render(
      <DataTable rows={[]} columns={[{id:"name", header:"Name", cell:()=>null}]} getRowKey={(_,index)=>index} selection={{visible:true,cell:()=>null}} action={{cell:()=>null}} emptyState="No records" pagination={<div>Page 1</div>} />,
    );
    expect(container.querySelector<HTMLTableCellElement>("tbody td")?.colSpan).toBe(3);
    expect(screen.getByText("No records")).toBeInTheDocument();
    expect(screen.queryByText("Page 1")).not.toBeInTheDocument();
  });
});
