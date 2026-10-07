import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/services/api/reportTemplates",async importOriginal=>({...await importOriginal<any>(),reportTemplatesApi:{list:vi.fn(),preview:vi.fn(),options:vi.fn(),detail:vi.fn(),sources:vi.fn(),roles:vi.fn(),save:vi.fn(),delete:vi.fn()}}));
vi.mock("@/services/api/reports",()=>({reportsApi:{createRun:vi.fn(),definitionHistory:vi.fn()}}));
vi.mock("../../shared/RealtimeReportPreview",()=>({RealtimeReportPreview:()=> <div>Server PDF preview</div>}));
const template:ReportTemplate={code:"DOCUMENT_STATUS",sourceCode:"DOCUMENT_STATUS",displayName:"Document Register",description:"Actual metadata",category:"DOCUMENT",classification:"REGULATED",active:true,definitionVersion:1,allowedFormats:["CSV"],limits:{},filterFields:[{code:"search",name:"Search documents",type:"TEXT"}],
  fields:[{code:"documentNumber",name:"Document Number",type:"TEXT",allowed:true,defaultSelected:true,required:true,order:0},{code:"documentName",name:"Document Name",type:"TEXT",allowed:true,defaultSelected:true,required:true,order:1}]};
const pagination={page:1,limit:10,total:1,totalPages:1};
beforeEach(()=>{
  vi.clearAllMocks(); vi.mocked(reportTemplatesApi.list).mockResolvedValue({data:[template],pagination});
  vi.mocked(reportTemplatesApi.preview).mockResolvedValue({rows:[["Document Number","Document Name"],["FORM-001","Visible report"]],asOfAt:"2026-10-03T00:00:00Z",pagination});
});
describe("Report Template server-owned flow",()=>{
  it("opens shared details and deletes only after a reason, pinning the server version",async()=>{
    vi.mocked(reportTemplatesApi.delete).mockResolvedValue(undefined);
    render(<MemoryRouter><ReportTemplateCatalog admin /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button",{name:"Document Register"}));
    expect(screen.getByRole("dialog",{name:"Template Details"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Close drawer"}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"Template Details"})).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button",{name:"More actions"}));
    fireEvent.click(screen.getByText("Delete Report Template"));
    expect(screen.getByRole("button",{name:"Delete Template"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason for deletion"),{target:{value:"Retire TEST template"}});
    expect(reportTemplatesApi.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Delete Template"}));
    await waitFor(()=>expect(reportTemplatesApi.delete).toHaveBeenCalledWith("DOCUMENT_STATUS",1,"Retire TEST template"));
  });
  it("sends catalog search and pagination to server rather than filtering the returned rows",async()=>{
    render(<MemoryRouter><ReportTemplateCatalog /></MemoryRouter>);
    await screen.findByRole("button",{name:"Document Register"});
    fireEvent.change(screen.getAllByPlaceholderText("Search report templates...")[0],{target:{value:"no local match"}});
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith({search:"no local match",page:1,sortBy:"displayName",direction:"asc"},false));
    expect(await screen.findByRole("button",{name:"Document Register"})).toBeInTheDocument();
  });
  it("delegates catalog status filters and column sorting to the server",async()=>{
    render(<MemoryRouter><ReportTemplateCatalog admin /></MemoryRouter>);
    await screen.findByRole("button",{name:"Document Register"});
    fireEvent.click(screen.getByRole("combobox",{name:"Status"}));
    fireEvent.click(screen.getByRole("option",{name:"Disabled"}));
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({status:"DISABLED",page:1}),true));
    fireEvent.click(screen.getByText("Last Updated"));
    await waitFor(()=>expect(reportTemplatesApi.list).toHaveBeenLastCalledWith(expect.objectContaining({status:"DISABLED",sortBy:"updatedAt",direction:"asc",page:1}),true));
    expect(screen.getByRole("button",{name:"Document Register"})).toBeInTheDocument();
  });
  it("previews criteria on server and queues the same version, fields and sort",async()=>{
    vi.mocked(reportsApi.createRun).mockResolvedValue({id:"run",status:"QUEUED"});
    render(<MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("Search documents..."),{target:{value:"FORM-001"}});
    expect(reportsApi.createRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Preview Report"}));
    await screen.findByText("Visible report");
    expect(reportTemplatesApi.preview).toHaveBeenCalledWith("DOCUMENT_STATUS",{version:1,fields:["documentNumber","documentName"],filters:{search:"FORM-001"},sortBy:"documentNumber",direction:"asc"},1);
    fireEvent.click(screen.getByRole("button",{name:"Continue to Output"}));
    fireEvent.click(screen.getByRole("button",{name:"Generate Report"}));
    await waitFor(()=>expect(reportsApi.createRun).toHaveBeenCalledWith({definitionCode:"DOCUMENT_STATUS",format:"CSV",fields:["documentNumber","documentName"],parameters:{search:"FORM-001",definitionVersion:1,reportTitle:"Document Register"},sort:[{field:"documentNumber",direction:"asc"}]},expect.any(String)));
  });
  it("keeps the idempotency key for a retry after a network failure",async()=>{
    vi.mocked(reportsApi.createRun).mockRejectedValue(new Error("network"));
    render(<MemoryRouter><ReportTemplateRun template={template} onBack={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Preview Report"}));await screen.findByText("Visible report");
    fireEvent.click(screen.getByRole("button",{name:"Continue to Output"}));fireEvent.click(screen.getByRole("button",{name:"Generate Report"}));
    await screen.findByRole("alert");fireEvent.click(screen.getByRole("button",{name:"Generate Report"}));
    await waitFor(()=>expect(reportsApi.createRun).toHaveBeenCalledTimes(2));
    expect(vi.mocked(reportsApi.createRun).mock.calls[0][1]).toEqual(vi.mocked(reportsApi.createRun).mock.calls[1][1]);
  });
  it("does not save configuration without an explicit reason and includes version and role grants atomically",async()=>{
    vi.mocked(reportTemplatesApi.detail).mockResolvedValue({...template,roleScopes:[{roleId:"role",scope:"DEPARTMENT"}]});
    vi.mocked(reportTemplatesApi.sources).mockResolvedValue([{code:"DOCUMENT_STATUS",name:"Document Register",fields:{documentNumber:"Document Number",documentName:"Document Name"},requiredFields:["documentNumber","documentName"]}]);
    vi.mocked(reportTemplatesApi.roles).mockResolvedValue([{id:"role",name:"QA",code:"QA"}]);
    vi.mocked(reportTemplatesApi.save).mockResolvedValue({...template,definitionVersion:2});
    render(<MemoryRouter initialEntries={["/settings/report-configuration/DOCUMENT_STATUS"]}><Routes><Route path="/settings/report-configuration/:code" element={<ReportTemplateEditor />} /></Routes></MemoryRouter>);
    await screen.findByDisplayValue("Document Register");expect(screen.getByRole("button",{name:"Save Changes"})).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Explain why this configuration is changing"),{target:{value:"Approved scope correction"}});
    fireEvent.click(screen.getByRole("tab", {name: "Fields & Defaults"}));
    await waitFor(() => expect(screen.queryByPlaceholderText("Explain why this configuration is changing")).not.toBeInTheDocument());
    expect(screen.getByRole("button", {name: "Save Changes"})).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", {name: "General"}));
    await screen.findByPlaceholderText("Explain why this configuration is changing");
    expect(screen.getAllByPlaceholderText("Explain why this configuration is changing")).toHaveLength(1);
    expect(screen.getByPlaceholderText("Explain why this configuration is changing")).toHaveValue("Approved scope correction");
    expect(reportTemplatesApi.save).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Save Changes"}));
    await waitFor(()=>expect(reportTemplatesApi.save).toHaveBeenCalledWith("DOCUMENT_STATUS",expect.objectContaining({version:1,reason:"Approved scope correction",roleScopes:[{roleId:"role",scope:"DEPARTMENT"}]}),false));
  });
});
