import { act,render,screen } from "@testing-library/react";
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { RealtimeReportPreview } from "../../shared/RealtimeReportPreview";
vi.mock("@/features/documents/shared/components/DocumentPdfViewer",()=>({DocumentPdfViewer:({fileUrl}:any)=><div data-testid="pdf">{fileUrl}</div>}));
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal("URL",{createObjectURL:vi.fn(()=>"blob:current"),revokeObjectURL:vi.fn()});});
afterEach(()=>{vi.useRealTimers();});
it("aborts superseded requests and never displays their late PDF",async()=>{
  let finish!:(blob:Blob)=>void;let firstSignal!:AbortSignal;
  const first=vi.fn((signal:AbortSignal)=>{firstSignal=signal;return new Promise<Blob>(resolve=>{finish=resolve;});});
  const next=vi.fn(async()=>new Blob(["current"]));const view=render(<RealtimeReportPreview requestKey="first" load={first}/>);
  await act(()=>vi.advanceTimersByTimeAsync(499));expect(first).not.toHaveBeenCalled();
  await act(()=>vi.advanceTimersByTimeAsync(1));expect(first).toHaveBeenCalledTimes(1);
  view.rerender(<RealtimeReportPreview requestKey="next" load={next}/>);expect(firstSignal.aborted).toBe(true);
  await act(async()=>finish(new Blob(["stale"])));expect(URL.createObjectURL).not.toHaveBeenCalled();
  await act(()=>vi.advanceTimersByTimeAsync(500));expect(screen.getByTestId("pdf")).toHaveTextContent("blob:current");view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:current");
});
it("never sends disabled previews to the server",async()=>{const load=vi.fn();render(<RealtimeReportPreview requestKey="disabled" disabled load={load}/>);await act(()=>vi.advanceTimersByTimeAsync(1000));expect(load).not.toHaveBeenCalled();});
