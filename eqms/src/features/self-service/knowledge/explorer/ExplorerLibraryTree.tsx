import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Files, FolderItem, FolderPanel, FolderTrigger, SubFiles } from "@/components/ui/files";
import { knowledgeApi } from "@/services/api/knowledge";
import type { KnowledgePortalOverview } from "@/services/api/knowledge";
import { folderColor, type ExplorerNav } from "./explorerModel";

interface ExplorerLibraryTreeProps {
  overview: KnowledgePortalOverview;
  nav: ExplorerNav;
  onGo: (nav: ExplorerNav) => void;
}

interface Child {
  key: string;
  label: string;
  documentCount: number;
}

type Loaded = { status: "loading" } | { status: "error" } | { status: "ready"; folders: Child[] };

/** One folder of the tree is identified by its Knowledge Base and the folder keys leading to it. */
const idOf = (kb: string, path: string[]) => JSON.stringify([kb, ...path]);

/**
 * The library as an expandable tree: every Knowledge Base opens into its folders, level by level. A level is read from the
 * server only when it is first opened, with the same call the main pane uses, and the tree opens by itself down to the
 * folder the user is in.
 */
export const ExplorerLibraryTree: React.FC<ExplorerLibraryTreeProps> = ({ overview, nav, onGo }) => {
  const hierarchyId = overview.selectedHierarchyId;
  const [open, setOpen] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const requested = useRef(new Set<string>());

  // Another hierarchy is another tree.
  useEffect(() => {
    setOpen([]);
    setLoaded({});
    requested.current = new Set();
  }, [hierarchyId]);

  const load = useCallback(
    (kb: string, path: string[]) => {
      const id = idOf(kb, path);
      if (requested.current.has(id)) return;
      requested.current.add(id);
      setLoaded((previous) => ({ ...previous, [id]: { status: "loading" } }));
      knowledgeApi
        .browse(hierarchyId ?? undefined, kb, path)
        .then((result) => setLoaded((previous) => ({ ...previous, [id]: { status: "ready", folders: result.folders } })))
        .catch(() => {
          requested.current.delete(id);
          setLoaded((previous) => ({ ...previous, [id]: { status: "error" } }));
        });
    },
    [hierarchyId],
  );

  // Show where the user is: open every level down to the current folder.
  useEffect(() => {
    if (nav.kind !== "kb") return;
    const ids: string[] = [];
    for (let depth = 0; depth <= nav.path.length; depth += 1) {
      const path = nav.path.slice(0, depth);
      ids.push(idOf(nav.kb.key, path));
      load(nav.kb.key, path);
    }
    setOpen((previous) => Array.from(new Set([...previous, ...ids])));
  }, [nav, load]);

  const renderFolders = (kb: { key: string; label: string }, path: string[]) => {
    const state = loaded[idOf(kb.key, path)];
    if (!state || state.status === "loading") return <p className="px-2 py-1.5 text-2xs text-slate-500 md:text-xs">Loading…</p>;
    if (state.status === "error") {
      return (
        <button type="button" onClick={() => load(kb.key, path)} className="px-2 py-1.5 text-left text-2xs text-red-600 underline md:text-xs">
          Could not load — try again
        </button>
      );
    }
    if (state.folders.length === 0) return <p className="px-2 py-1.5 text-2xs text-slate-500 md:text-xs">No folders</p>;
    return state.folders.map((folder) => {
      const childPath = [...path, folder.key];
      const active = nav.kind === "kb" && nav.kb.key === kb.key && nav.path.length === childPath.length && nav.path.every((key, index) => key === childPath[index]);
      return (
        <FolderItem key={folder.key} value={idOf(kb.key, childPath)}>
          <FolderTrigger
            active={active}
            toggleLabel={`Toggle ${folder.label}`}
            onOpen={() => load(kb.key, childPath)}
            onPrefetch={() => load(kb.key, childPath)}
            onSelect={() => onGo({ kind: "kb", kb, path: childPath })}
            trailing={<span className="text-xs tabular-nums text-slate-400">{folder.documentCount}</span>}
          >
            {folder.label}
          </FolderTrigger>
          <FolderPanel>
            <SubFiles>{renderFolders(kb, childPath)}</SubFiles>
          </FolderPanel>
        </FolderItem>
      );
    });
  };

  return (
    <Files open={open} onOpenChange={setOpen} aria-label="Knowledge Bases">
      {overview.knowledgeBases.map((kb) => {
        const target = { key: kb.key, label: kb.label };
        const active = nav.kind === "kb" && nav.kb.key === kb.key && nav.path.length === 0;
        return (
          <FolderItem key={kb.key} value={idOf(kb.key, [])}>
            <FolderTrigger
              active={active}
              toggleLabel={`Toggle ${kb.label}`}
              onOpen={() => load(kb.key, [])}
              onPrefetch={() => load(kb.key, [])}
              onSelect={() => onGo({ kind: "kb", kb: target, path: [] })}
              icon={<span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: folderColor(kb.label) }} />}
              trailing={
                <>
                  {kb.subscribed && <Bell className="h-4 w-4 shrink-0 text-emerald-600 md:h-3 md:w-3" aria-label="Subscribed" />}
                  <span className="text-xs tabular-nums text-slate-400">{kb.documentCount}</span>
                </>
              }
            >
              {kb.label}
            </FolderTrigger>
            <FolderPanel>
              <SubFiles>{renderFolders(target, [])}</SubFiles>
            </FolderPanel>
          </FolderItem>
        );
      })}
    </Files>
  );
};
