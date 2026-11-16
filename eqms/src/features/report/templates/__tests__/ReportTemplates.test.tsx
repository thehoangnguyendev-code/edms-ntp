import "../../testing/browserStubs";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportTemplateCatalog } from "../ReportTemplateCatalog";
import { ReportTemplateRun } from "../ReportTemplateRun";
import { ReportTemplateEditor } from "../ReportTemplateEditor";
import { reportTemplatesApi, type ReportTemplate } from "@/services/api/reportTemplates";
import { reportsApi } from "@/services/api/reports";

vi.mock("@/components/ui/page/PageHeader",()=>({PageHeader:({title,actions}:any)=><header><h1>{title}</h1>{actions}</header>}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({hasAnyPermission:()=>true})}));
vi.mock("@/components/branding/BrandLogo",()=>({useBranding:()=>({compactDesktopFilters:false})}));
vi.mock("@/services/api/reportTemplates",async importOriginal=>({...await importOriginal<any>(),reportTemplatesApi:{list:vi.fn(),preview:vi.fn(),options:vi.fn(),detail:vi.fn(),sources:vi.fn(),roles:vi.fn(),save:vi.fn(),delete:vi.fn(),capabilities:vi.fn(),newWorkflow:vi.fn().mockResolvedValue({steps:[{code:"DRAFT",label:"Draft",terminal:false}],currentStepIndex:0,skippedSteps:[],terminalProgressStep:""})}}));
vi.mock("@/services/api/reports",()=>({reportsApi:{createRun:vi.fn(),definitionHistory:vi.fn(),listPins:vi.fn().mockResolvedValue([]),pinReport:vi.fn().mockResolvedValue({}),unpinReport:vi.fn().mockResolvedValue({})}}));
vi.mock("../../shared/RealtimeReportPreview",()=>({RealtimeReportPreview:()=> <div>Server PDF preview</div>}));
const template:ReportTemplate={code:"DOCUMENT_STATUS",sourceCode:"DOCUMENT_STATUS",displayName:"Document Register",description:"Actual metadata",category:"DOCUMENT",classification:"REGULATED",active:true,definitionVersion:1,allowedFormats:["CSV"],limits:{},filterFields:[{code:"search",name:"Search documents",type:"TEXT"}],
  fields:[{code:"documentNumber",name:"Document Number",type:"TEXT",allowed:true,defaultSelected:true,required:true,order:0},{code:"documentName",name:"Document Name",type:"TEXT",allowed:true,defaultSelected:true,required:true,order:1}]};
const pagination={page:1,limit:10,total:1,totalPages:1};
const everyAction = ["viewRevisions","edit","submitForApproval","approve","reject","upgrade","discardRevision","disable","enable","delete","createReport"];
beforeEach(()=>{
  vi.mocked(reportTemplatesApi.capabilities).mockResolvedValue({resourceType:"REPORT_TEMPLATE",resourceId:"DOCUMENT_STATUS",state:"DRAFT",actions:Object.fromEntries(everyAction.map(a=>[a,{allowed:true}]))} as never);
  vi.clearAllMocks(); // The list carries what the person may do with each template: the row menu opens complete, with no request after the click.
  const withActions={...template,capabilities:{resourceType:"REPORT_TEMPLATE",resourceId:"DOCUMENT_STATUS",state:"DRAFT",actions:Object.fromEntries(everyAction.map(action=>[action,{allowed:true}]))}} as never;
  vi.mocked(reportTemplatesApi.list).mockResolvedValue({data:[withActions],pagination});
  vi.mocked(reportTemplatesApi.preview).mockResolvedValue({rows:[["Document Number","Document Name"],["FORM-001","Visible report"]],asOfAt:"2026-10-03T00:00:00Z",pagination});
});
describe("Report Template server-owned flow",()=>{
  it("opens a template on a page of its own, not in a drawer", async () => {
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/report/template-management"]}>
          <Routes>
            <Route path="/report/template-management" element={<ReportTemplateCatalog inAdministration />} />
            <Route path="/report/template-management/:code/details" element={<h2>Template page</h2>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "DOCUMENT_STATUS" }));
    expect(await screen.findByText("Template page")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Template Details" })).not.toBeInTheDocument();
  });
  it("deletes only after a reason, pinning the server version", async () => {
    vi.mocked(reportTemplatesApi.delete).mockResolvedValue(undefined);
    render(<ToastProvider><MemoryRouter><ReportTemplateCatalog inAdministration /></MemoryRouter></ToastProvider>);
    await screen.findByRole("button", { name: "DOCUMENT_STATUS" });
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("Delete Report Template"));
    expect(reportTemplatesApi.capabilities).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete Template" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason for deletion"), { target: { value: "Retire TEST template" } });
    expect(reportTemplatesApi.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete Template" }));
    await waitFor(() => expect(reportTemplatesApi.delete).toHaveBeenCalledWith("DOCUMENT_STATUS", 1, "Retire TEST template"));
  });
  it("sends catalog search and pagination to server rather than filtering the returned rows",async()=>{
    render(<ToastProvider><MemoryRouter><ReportTemplateCatalog /></MemoryRouter></ToastProvider>);
    await screen.findByRole("button",{name:"DOCUMENT_STATUS"});
    fireEvent.change(screen.getAllByPlaceholderText("Search report templates...")[0],{target:{value:"no local match"}});
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith({search:"no local match",page:1,limit:10,sortBy:"displayName",direction:"asc"},false));
    expect(await screen.findByRole("button",{name:"DOCUMENT_STATUS"})).toBeInTheDocument();
  });
  it("delegates catalog status filters and column sorting to the server",async()=>{
    render(<ToastProvider><MemoryRouter><ReportTemplateCatalog inAdministration /></MemoryRouter></ToastProvider>);
    await screen.findByRole("button",{name:"DOCUMENT_STATUS"});
    fireEvent.click(screen.getByRole("combobox",{name:"Status"}));
    fireEvent.click(screen.getByRole("option",{name:"Disabled"}));
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({status:"DISABLED",page:1}),true));
    fireEvent.click(screen.getByText("Last Updated"));
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({status:"DISABLED",sortBy:"updatedAt",direction:"asc",page:1}),true));
    expect(screen.getByRole("button",{name:"DOCUMENT_STATUS"})).toBeInTheDocument();
  });
  it("previews criteria on server and queues the same version, fields and sort",async()=>{
    vi.mocked(reportsApi.createRun).mockResolvedValue({id:"run",status:"QUEUED"});
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    fireEvent.change(screen.getByPlaceholderText("Search documents..."),{target:{value:"FORM-001"}});
    expect(reportsApi.createRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);
    await screen.findByText("Visible report");
    expect(reportTemplatesApi.preview).toHaveBeenCalledWith("DOCUMENT_STATUS",{version:1,fields:["documentNumber","documentName"],filters:{search:"FORM-001"},sortBy:"documentNumber",direction:"asc"},1);
    fireEvent.click(screen.getAllByRole("button",{name:"Continue to Output"})[0]);
    fireEvent.click(screen.getAllByRole("button",{name:"Generate Report"})[0]);
    await waitFor(()=>expect(reportsApi.createRun).toHaveBeenCalledWith({definitionCode:"DOCUMENT_STATUS",format:"CSV",fields:["documentNumber","documentName"],parameters:{search:"FORM-001",definitionVersion:1,reportTitle:"Document Register"},sort:[{field:"documentNumber",direction:"asc"}],full:false},expect.any(String)));
  });
  it("keeps the idempotency key for a retry after a network failure",async()=>{
    vi.mocked(reportsApi.createRun).mockRejectedValue(new Error("network"));
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    fireEvent.click(screen.getByRole("radio",{name:/Full report/}));
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);await screen.findByText("Visible report");
    fireEvent.click(screen.getAllByRole("button",{name:"Continue to Output"})[0]);fireEvent.click(screen.getAllByRole("button",{name:"Generate Report"})[0]);
    await screen.findByRole("dialog",{name:/Cannot Create Report/});fireEvent.click(within(screen.getByRole("dialog",{name:/Cannot Create Report/})).getByRole("button",{name:/^Close$/}));fireEvent.click(screen.getAllByRole("button",{name:"Generate Report"})[0]);
    await waitFor(()=>expect(reportsApi.createRun).toHaveBeenCalledTimes(2));
    expect(vi.mocked(reportsApi.createRun).mock.calls[0][1]).toEqual(vi.mocked(reportsApi.createRun).mock.calls[1][1]);
  });
  it("needs a filter or the Full choice before a report is previewed, and sends the Full choice with the run (REPORT-FULL-RUN-2026-11-12)",async()=>{
    vi.mocked(reportsApi.createRun).mockResolvedValue({id:"run",status:"QUEUED"});
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    expect(screen.getAllByRole("button",{name:"Preview Report"})[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("radio",{name:/Full report/}));
    expect(screen.getAllByRole("button",{name:"Preview Report"})[0]).toBeEnabled();
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);await screen.findByText("Visible report");
    fireEvent.click(screen.getAllByRole("button",{name:"Continue to Output"})[0]);fireEvent.click(screen.getAllByRole("button",{name:"Generate Report"})[0]);
    await waitFor(()=>expect(reportsApi.createRun).toHaveBeenCalledWith(expect.objectContaining({full:true}),expect.any(String)));
  });
  it("is one card of three steps: the scope is chosen first, the report name is asked only at Output, and Clear Filters waits for a filter",async()=>{
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    expect(screen.getByRole("radio",{name:/Filtered/})).toBeChecked();
    expect(screen.getByRole("radio",{name:/Full report/})).not.toBeChecked();
    expect(screen.queryByLabelText(/Generated Report Name/)).not.toBeInTheDocument();
    const filters=within(screen.getByRole("region",{name:"Filters and sort"}));
    expect(filters.getByRole("button",{name:"Clear Filters"})).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Search documents..."),{target:{value:"FORM-001"}});
    expect(filters.getByRole("button",{name:"Clear Filters"})).toBeEnabled();
    expect(screen.queryAllByRole("button",{name:"Previous"})).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);await screen.findByText("Visible report");
    expect(screen.getAllByRole("button",{name:"Previous"}).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button",{name:"Continue to Output"})[0]);
    expect(await screen.findByLabelText(/Generated Report Name/)).toBeInTheDocument();
  });
  it("marks a required filter with a red * and keeps Preview Report disabled until it is filled, in the header and at the bottom", async () => {
    const withDates = { ...template, filterFields: [{ code: "createdFrom", name: "From Date", type: "TEXT" as const, required: "true" }, { code: "search", name: "Search documents", type: "TEXT" as const }] };
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={withDates} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    expect(screen.getByText("From Date").parentElement?.querySelector(".text-red-600")?.textContent).toBe("*");
    expect(screen.getAllByRole("button", { name: "Preview Report" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: /Full report/ }));
    screen.getAllByRole("button", { name: "Preview Report" }).forEach((button) => expect(button).toBeDisabled());
  });
  it("shows a pair of date filters (xFrom, xTo) as one date range field, with a red * when required", () => {
    const withRange = { ...template, filterFields: [{ code: "createdFrom", name: "From Date", type: "DATE" as const, required: "true" }, { code: "createdTo", name: "To Date", type: "DATE" as const, required: "true" }] };
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={withRange} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    const label = screen.getByText("Created Date Range");
    expect(label.parentElement?.querySelector(".text-red-600")?.textContent).toBe("*");
    expect(screen.queryByText("From Date")).not.toBeInTheDocument();
    expect(screen.queryByText("To Date")).not.toBeInTheDocument();
  });
  it("asks for a signature before a report of a signed type is queued, and gives the reason in the signature window (REPORT-RUN-SIGNATURE-2026-11-12)",async()=>{
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={{...template,runNeedsSignature:true}} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    fireEvent.click(screen.getByRole("radio",{name:/Full report/}));
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);await screen.findByText("Visible report");
    fireEvent.click(screen.getAllByRole("button",{name:"Continue to Output"})[0]);
    const generate=screen.getAllByRole("button",{name:"Sign And Generate Report"})[0];
    expect(screen.queryByLabelText(/Reason For This Report/)).toBeNull(); // one reason only: the one of the signature window
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    expect(reportsApi.createRun).not.toHaveBeenCalled(); // nothing is queued before the signature is given
  });
  it("offers only CSV and XLSX, and shows the file (not a page preview), for a result above the ordinary limit",async()=>{
    vi.mocked(reportTemplatesApi.preview).mockResolvedValue({rows:[["Document Number","Document Name"],["FORM-001","Visible report"]],asOfAt:"2026-10-03T00:00:00Z",pagination:{page:1,limit:10,total:20000,totalPages:2000},maxRows:10000,maxRowsFull:100000} as never);
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={{...template,allowedFormats:["PDF","XLSX","CSV"]}} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    fireEvent.click(screen.getByRole("radio",{name:/Full report/}));
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);await screen.findByText("Visible report");
    fireEvent.click(screen.getAllByRole("button",{name:"Continue to Output"})[0]);
    expect(await screen.findByText(/CSV file preview|XLSX file preview/)).toBeInTheDocument();
    expect(screen.queryByText("Server PDF preview")).toBeNull();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
    expect(screen.queryByText("PDF")).toBeNull();
  });
  it("does not let a result above the Full limit continue",async()=>{
    vi.mocked(reportTemplatesApi.preview).mockResolvedValue({rows:[["Document Number","Document Name"],["FORM-001","Visible report"]],asOfAt:"2026-10-03T00:00:00Z",pagination:{page:1,limit:10,total:150000,totalPages:15000},maxRows:10000,maxRowsFull:100000} as never);
    render(<ToastProvider><MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter></ToastProvider>);
    fireEvent.click(screen.getByRole("radio",{name:/Full report/}));
    fireEvent.click(screen.getAllByRole("button",{name:"Preview Report"})[0]);await screen.findByText("Visible report");
    expect(screen.getByRole("alert")).toHaveTextContent("more than a Full report file may hold");
    expect(screen.getAllByRole("button",{name:"Continue to Output"})[0]).toBeDisabled();
  });
  it("does not save a template without a description and includes version and role grants atomically",async()=>{
    vi.mocked(reportTemplatesApi.detail).mockResolvedValue({...template,description:"",roleScopes:[{roleId:"role",scope:"DEPARTMENT"}]});
    vi.mocked(reportTemplatesApi.sources).mockResolvedValue([{code:"DOCUMENT_STATUS",name:"Document Register",fields:{documentNumber:"Document Number",documentName:"Document Name"},requiredFields:["documentNumber","documentName"]}]);
    vi.mocked(reportTemplatesApi.roles).mockResolvedValue([{id:"role",name:"QA",code:"QA"}]);
    vi.mocked(reportTemplatesApi.save).mockResolvedValue({...template,definitionVersion:2});
    render(<MemoryRouter initialEntries={["/report/template-management/DOCUMENT_STATUS"]}><Routes><Route path="/report/template-management/:code" element={<ReportTemplateEditor />} /></Routes></MemoryRouter>);
    await screen.findByDisplayValue("Document Register");expect(screen.getAllByRole("button",{name:"Save"})[0]).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Enter template description"),{target:{value:"Approved scope correction"}});
    fireEvent.click(screen.getByRole("tab", {name: "Fields & Defaults"}));
    expect(screen.getAllByRole("button",{name:"Save"})[0]).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", {name: "General"}));
    expect(await screen.findByPlaceholderText("Enter template description")).toHaveValue("Approved scope correction");
    expect(reportTemplatesApi.save).not.toHaveBeenCalled();fireEvent.click(screen.getAllByRole("button",{name:"Save"})[0]);
    await waitFor(()=>expect(reportTemplatesApi.save).toHaveBeenCalledWith("DOCUMENT_STATUS",expect.objectContaining({version:1,description:"Approved scope correction",reason:"",roleScopes:[{roleId:"role",scope:"DEPARTMENT"}]}),false));
  });
});

describe("Report Library page size", () => {
  it("shows the records-per-page choice and asks the server for the chosen number", async () => {
    vi.mocked(reportTemplatesApi.list).mockResolvedValue({ data: [template], pagination: { page: 1, limit: 10, total: 30, totalPages: 3 }, sources: [] } as never);
    render(<ToastProvider><MemoryRouter><ReportTemplateCatalog /></MemoryRouter></ToastProvider>);
    await screen.findByRole("button", { name: "DOCUMENT_STATUS" });
    expect(screen.getByText("Show:")).toBeInTheDocument();
    expect(reportTemplatesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10, page: 1 }), false);
  });
});

describe("GMP in the list of templates",()=>{
  it("shows whether each template is used for GMP decisions, and sends the filter to the server",async()=>{
    const gmp={...template,code:"RPT.0024",displayName:"Batch release",gmpUse:true} as never;
    const plain={...template,code:"RPT.0008",displayName:"Audit e2e",gmpUse:false} as never;
    vi.mocked(reportTemplatesApi.list).mockResolvedValue({data:[gmp,plain],pagination:{page:1,limit:10,total:2,totalPages:1}});
    render(<ToastProvider><MemoryRouter><ReportTemplateCatalog inAdministration /></MemoryRouter></ToastProvider>);
    await screen.findByRole("button",{name:"RPT.0024"});
    expect(screen.getAllByText("GMP").length).toBeGreaterThan(0); // the badge (the column heading is Used for GMP Decisions)
    expect(screen.getByText("Used for GMP Decisions",{selector:"th, th *"})).toBeInTheDocument();
    expect(screen.getByText("Not GMP")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox",{name:"Used for GMP Decisions"}));
    fireEvent.click(await screen.findByRole("option",{name:"No"}));
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({gmp:"NO"}),true));
  });
});

describe("Titles of the revision pages (REPORT-REVISION-TITLES-2026-11-15)",()=>{
  const open=(path:string)=>render(<ToastProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/report/template-management/:code" element={<ReportTemplateEditor />} /></Routes></MemoryRouter></ToastProvider>);
  beforeEach(()=>{
    vi.mocked(reportTemplatesApi.sources).mockResolvedValue([{code:"DOCUMENT_STATUS",name:"Document Register",fields:{documentNumber:"Document Number",documentName:"Document Name"},requiredFields:["documentNumber"]}] as never);
    vi.mocked(reportTemplatesApi.roles).mockResolvedValue([]);
  });
  it("a template that is not made yet is Create Report Template",async()=>{
    open("/report/template-management/new");
    expect(await screen.findByRole("heading",{name:"Create Report Template"})).toBeInTheDocument();
  });
  it("a Draft the person may edit is Edit Revision, and the old names are gone",async()=>{
    vi.mocked(reportTemplatesApi.detail).mockResolvedValue({...template,lifecycleStatus:"DRAFT",approvalStatus:"DRAFT",gmpUse:false,definitionVersion:3} as never);
    open("/report/template-management/DOCUMENT_STATUS");
    expect(await screen.findByRole("heading",{name:"Edit Revision"})).toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:"Report Template Configuration"})).not.toBeInTheDocument();
    expect(screen.queryByRole("heading",{name:"New Report Template"})).not.toBeInTheDocument();
  });
});
describe("Reject a report template",()=>{
  it("is called Reject, asks for a reason first, and tells the author by the application and by e-mail",async()=>{
    vi.mocked(reportTemplatesApi.detail).mockResolvedValue({...template,lifecycleStatus:"PENDING_APPROVAL",approvalStatus:"PENDING_APPROVAL",gmpUse:false,definitionVersion:3} as never);
    vi.mocked(reportTemplatesApi.sources).mockResolvedValue([{code:"DOCUMENT_STATUS",name:"Document Register",fields:{documentNumber:"Document Number",documentName:"Document Name"},requiredFields:["documentNumber","documentName"]}]);
    vi.mocked(reportTemplatesApi.roles).mockResolvedValue([]);
    render(<ToastProvider><MemoryRouter initialEntries={["/report/template-management/DOCUMENT_STATUS"]}><Routes><Route path="/report/template-management/:code" element={<ReportTemplateEditor />} /></Routes></MemoryRouter></ToastProvider>);
    const reject=(await screen.findAllByRole("button",{name:"Reject"}))[0];
    expect(screen.queryByText(/Return to Draft/i)).not.toBeInTheDocument();
    fireEvent.click(reject);
    expect(await screen.findByText("Reject Revision")).toBeInTheDocument();
    // The page is named by the work: a revision waiting for this person's decision is "Approve Revision".
    expect(screen.getByRole("heading",{name:"Approve Revision"})).toBeInTheDocument();
    expect(screen.getByText(/by e-mail/)).toBeInTheDocument();
    // no reason, no way on to the signature
    expect(screen.getByRole("button",{name:"Continue to sign"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Reason/),{target:{value:"Add the department column"}});
    expect(screen.getByRole("button",{name:"Continue to sign"})).toBeEnabled();
  });
});
