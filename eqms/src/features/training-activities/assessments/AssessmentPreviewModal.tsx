import { useCallback, useEffect, useRef, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { DocumentPdfViewer } from "@/features/documents/shared/components/DocumentPdfViewer";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type View = "test" | "key" | "both";

const TABS: TabItem[] = [
  { id: "test", label: "Test Paper" },
  { id: "key", label: "Answer Key" },
  { id: "both", label: "Side by Side" },
];
/** A phone is too narrow for two pages beside each other: it has the two papers as tabs, without Side by Side. */
const PHONE_TABS = TABS.filter((t) => t.id !== "both");

/**
 * The preview of an assessment of the library in a window of the page: one tab for the paper of the trainee, one for the paper with the answer key, and one that shows both in ONE viewer, the
 * test paper page beside the answer key page (the server puts the two papers in one file), so that scrolling and zooming apply to both at the same time; the window is wider then. The test
 * paper is made when the window opens; the other two only when they are first looked at (each is a conversion by the document server). Nothing is stored. One button closes the window.
 */
export function AssessmentPreviewModal({ title, description, firstUrl, load, onClose }: {
  title: string;
  description?: string;
  /** The test paper, already made when the window opens. */
  firstUrl: string;
  /** Makes a paper and gives the address of the PDF: the test paper, the paper with the answer key, or the two in one file. */
  load: (paper: "key" | "both") => Promise<string>;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<View>("test");
  const roomForTwo = useMediaQuery("(min-width: 768px)");
  // a window that was wide and is now narrow (a phone turned round) goes back to the test paper
  const view: View = chosen === "both" && !roomForTwo ? "test" : chosen;
  const [urls, setUrls] = useState<{ test: string; key?: string; both?: string }>({ test: firstUrl });
  const [loading, setLoading] = useState<Partial<Record<"key" | "both", boolean>>>({});
  const [error, setError] = useState("");
  const made = useRef<string[]>([firstUrl]);

  // The papers made for this window are released when the window is really gone. React may run the cleanup of an effect and the effect again at once (a window that is set up twice in
  // development), and a paper released then would not load ("Failed to fetch"): the release waits to see that the window did not come back.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => { if (!mounted.current) made.current.forEach((u) => URL.revokeObjectURL(u)); }, 0);
    };
  }, []);

  const ensure = useCallback(async (paper: "key" | "both") => {
    if (urls[paper] || loading[paper]) return;
    setLoading((previous) => ({ ...previous, [paper]: true }));
    setError("");
    try {
      const url = await load(paper);
      made.current.push(url);
      setUrls((previous) => ({ ...previous, [paper]: url }));
    } catch {
      setError("The paper could not be made. Try again.");
    } finally {
      setLoading((previous) => ({ ...previous, [paper]: false }));
    }
  }, [load, urls, loading]);

  const choose = (next: string) => {
    setChosen(next as View);
    if (next !== "test") void ensure(next as "key" | "both");
  };

  const url = urls[view];
  const wide = view === "both" && roomForTwo;
  return (
    <FormModal
      isOpen
      onClose={onClose}
      onConfirm={onClose}
      title={title}
      description={description}
      confirmText="Close"
      showCancel={false}
      size="2xl"
      // no blur on the window: a blur makes the window the reference of the fixed menus of the viewer (the zoom menu would open far from its button)
      // the window opens wider for Side by Side and closes again for the other tabs: the width moves smoothly
      className={`${wide ? "max-w-[96vw]" : "max-w-6xl"} backdrop-blur-none transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
    >
      <div className="space-y-3">
        <TabNav tabs={roomForTwo ? TABS : PHONE_TABS} activeTab={view} onChange={choose} layoutId="training-assessment-preview-tab" variant="simple-underline" />
        {url ? (
          <DocumentPdfViewer key={url} fileUrl={url} height="74dvh" minHeight="420px" forceHideDownloadAndPrint allowContextMenu={false} />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50" style={{ height: "74dvh", minHeight: "420px" }}>
            {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <SectionLoading text="Making the paper…" />}
          </div>
        )}
      </div>
    </FormModal>
  );
}
