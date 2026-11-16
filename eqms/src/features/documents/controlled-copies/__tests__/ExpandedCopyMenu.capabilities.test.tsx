import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const api=vi.hoisted(()=>({list:vi.fn(),copy:vi.fn(),batch:vi.fn()}));
vi.mock("@/services/api/documents",()=>({
  CONTROLLED_COPY_MUTATED_EVENT:"copy-mutated",
  documentApi:{getControlledCopyDistributionBatchCopies:api.list,getControlledCopyActionCapabilities:api.copy,getControlledCopyBatchActionCapabilities:api.batch},
}));
vi.mock("@/hooks",()=>({
  useNavigateWithLoading:()=>({navigateTo:vi.fn(),navigateToPrepared:vi.fn()}),
  usePortalDropdown:()=>{
    const [openId,setOpenId]=React.useState<string|null>(null);
    return {openId,position:{top:0,left:0},getRef:()=>React.createRef<HTMLButtonElement>(),
      toggle:(id:string)=>setOpenId(old=>old===id?null:id),close:()=>setOpenId(null)};
  },
}));
import { ExpandControlledCopiesRow, getCachedControlledCopyChildren, preloadControlledCopyChildren, invalidateControlledCopyChildren } from "../components/ExpandControlledCopiesRow";
import { authTokenStore } from "@/services/authTokenStore";
afterEach(()=>{cleanup();vi.clearAllMocks();vi.restoreAllMocks();authTokenStore.clear();});

it.each([true,false,null])("opens the complete member menu from server data (allowed=%s) without a capability request",async allowed=>{
  const batchId=`batch-${allowed}`;
  api.list.mockResolvedValue({data:[{id:`copy-${allowed}`,controlledCopyNumber:"CC.001",name:"Copy",statusCode:"READY_FOR_DISTRIBUTION",
    capabilities:allowed===null?null:{actions:{distributeCopy:{allowed},recallCopy:{allowed:false},cancelRequest:{allowed:false}}}}],
    pagination:{total:1}});
  render(<table><tbody><ExpandControlledCopiesRow source={{id:batchId,batchId,batchQuantity:2} as any}
    isExpanded visibleColumnsLength={8} onViewDetails={vi.fn()} onDistribute={vi.fn()}/></tbody></table>);
  const trigger=await screen.findByRole("button",{name:"More actions"});
  fireEvent.click(trigger);
  expect(screen.getByRole("button",{name:"View Details"})).toBeInTheDocument();
  if(allowed) expect(screen.getByRole("button",{name:/^Distribute$/})).toBeEnabled();
  else expect(screen.queryByRole("button",{name:/^Distribute$/})).not.toBeInTheDocument();
  expect(api.copy).not.toHaveBeenCalled();
  expect(api.batch).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(1);
});

it("never reuses another session's decisions and expires old cached decisions",async()=>{
  const clock=vi.spyOn(Date,"now").mockReturnValue(1000);
  authTokenStore.set("session-a");
  api.list.mockResolvedValue({data:[{id:"member",capabilities:{actions:{distributeCopy:{allowed:true}}}}]});
  await preloadControlledCopyChildren("session-cache-test");
  expect(getCachedControlledCopyChildren("session-cache-test")?.[0].capabilities?.actions?.distributeCopy?.allowed).toBe(true);
  authTokenStore.set("session-b");
  expect(getCachedControlledCopyChildren("session-cache-test")).toBeNull();
  api.list.mockResolvedValue({data:[{id:"member",capabilities:{actions:{distributeCopy:{allowed:false}}}}]});
  await preloadControlledCopyChildren("session-cache-test");
  expect(getCachedControlledCopyChildren("session-cache-test")?.[0].capabilities?.actions?.distributeCopy?.allowed).toBe(false);
  clock.mockReturnValue(6001);
  expect(getCachedControlledCopyChildren("session-cache-test")).toBeNull();
  expect(api.list).toHaveBeenCalledTimes(2);
});

it("an invalidated in-flight page cannot overwrite a newer capability response",async()=>{
  let resolveOld!:(value:any)=>void;
  api.list.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;}));
  const old=preloadControlledCopyChildren("in-flight-test");
  invalidateControlledCopyChildren("in-flight-test");
  api.list.mockResolvedValueOnce({data:[{id:"new",capabilities:{actions:{distributeCopy:{allowed:false}}}}]});
  await preloadControlledCopyChildren("in-flight-test");
  resolveOld({data:[{id:"old",capabilities:{actions:{distributeCopy:{allowed:true}}}}]});
  await old;
  expect(getCachedControlledCopyChildren("in-flight-test")?.[0].id).toBe("new");
});
