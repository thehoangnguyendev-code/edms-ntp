import { TabNav } from "@/components/ui/tabs/TabNav";
import { TrainingCopyBlock } from "./TrainingCopyBlock";

/**
 * The copies sent to the departments, in a card of its own below the command buttons of a detail screen, as the lists under Document Details are.
 * The tab names the content; the "Send a copy" button sits on the right of the card.
 */
export function TrainingCopiesPanel({ type, objectId }: { type: "job-assignment" | "requirement"; objectId: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <TabNav tabs={[{ id: "copies", label: "Copies Sent To Departments" }]} activeTab="copies" onChange={() => undefined} layoutId={`training-copies-${type}`} />
      <div className="p-4 md:p-5">
        <TrainingCopyBlock type={type} objectId={objectId} title="" />
      </div>
    </div>
  );
}
