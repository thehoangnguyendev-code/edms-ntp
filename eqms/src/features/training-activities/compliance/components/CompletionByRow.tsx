import { TableMarkup } from "@/components/ui/table/TablePrimitives";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { CompletionColumn, CompletionState, CompletionSummary } from "@/services/api/trainingActivities";
import { STATE_STYLE } from "./CompletionHeatmap";

/** The three groups of rows of APD.0011 (SOP.0003 5.3.1), in the order of the form. */
const GROUPS: { id: CompletionColumn["group"]; title: string }[] = [
  { id: "FACTORY_GENERAL", title: "General training of the whole factory" },
  { id: "DEPARTMENT_GENERAL", title: "General training of the department" },
  { id: "SOP", title: "SOP for each position" },
];
/** Order of the segments of a bar: done first, then what is under way, then what is missing. */
const BAR_ORDER: CompletionState[] = ["QUALIFIED", "IN_PROGRESS", "UPDATE_NEEDED", "DUE", "REQUIRED"];
const BAR_COLOR: Record<CompletionState, string> = {
  QUALIFIED: "bg-emerald-500", IN_PROGRESS: "bg-sky-400", UPDATE_NEEDED: "bg-amber-400", DUE: "bg-orange-400", REQUIRED: "bg-red-400", NOT_REQUIRED: "bg-slate-200",
};

type RowFacts = { column: CompletionColumn; counts: Record<string, number>; required: number; qualified: number; open: CompletionSummary["rows"][string]["open"]; openTotal: number };

function factsOf(column: CompletionColumn, summary: CompletionSummary | undefined): RowFacts {
  const row = summary?.rows[column.rowId];
  const counts = row?.counts ?? {};
  const required = BAR_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  return { column, counts, required, qualified: counts.QUALIFIED ?? 0, open: row?.open ?? [], openTotal: (row?.open.length ?? 0) + (row?.moreOpen ?? 0) };
}

/** Segmented bar of one row: how the people who must be trained on it are spread over the states. Counts are the server's. */
function RowBar({ facts }: { facts: RowFacts }) {
  if (facts.required === 0) return <span className="text-xs text-slate-400">Nobody has to be trained</span>;
  const pct = Math.round((facts.qualified / facts.required) * 100);
  const label = BAR_ORDER.filter((s) => facts.counts[s]).map((s) => `${STATE_STYLE[s].label}: ${facts.counts[s]}`).join(", ");
  return (
    <div className="min-w-40">
      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold tabular-nums text-slate-800">{facts.qualified} / {facts.required}</span><span className="tabular-nums text-slate-500">{pct}%</span></div>
      <div role="img" aria-label={label} title={label} className="mt-1 flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-slate-100">
        {BAR_ORDER.filter((s) => facts.counts[s]).map((s) => <span key={s} className={BAR_COLOR[s]} style={{ width: `${(facts.counts[s] / facts.required) * 100}%` }} />)}
      </div>
    </div>
  );
}

function PersonChip({ name, code, status }: { name: string; code?: string | null; status: CompletionState }) {
  const st = STATE_STYLE[status];
  return (
    <li className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-white px-2.5 py-1 text-xs font-medium ${st.fill.split(" ")[0]} ${st.text}`} title={`${st.label}: ${name}`}>
      <span className="shrink-0 [&_svg]:h-3 [&_svg]:w-3">{st.icon}</span>
      <span className="truncate">{name}</span>{code && <span className="shrink-0 font-normal opacity-70">{code}</span>}
    </li>
  );
}

function OpenPeople({ facts }: { facts: RowFacts }) {
  if (facts.openTotal === 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">{STATE_STYLE.QUALIFIED.icon}Everyone is done</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="People still to be trained">
      {facts.open.map((p) => <PersonChip key={p.personId} name={p.fullName} code={p.employeeCode} status={p.status as CompletionState} />)}
      {facts.openTotal > facts.open.length && <li className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">and {facts.openTotal - facts.open.length} more</li>}
    </ul>
  );
}

function Annual({ yes }: { yes: boolean }) {
  return yes
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"><RefreshCw className="h-3 w-3" />Yes</span>
    : <span className="text-xs font-semibold text-slate-400">No</span>;
}

/**
 * Matrix completion laid out as the form APD.0011: one line per row of the matrix (No, SOP No, Subject / SOP title, Annual training Yes / No) in its three
 * groups, with how far the people of the position are through it and who is still to be trained. A row opens to name them. On a phone each row is a card.
 */
export function CompletionByRow({ columns, summary }: { columns: CompletionColumn[]; summary?: CompletionSummary }) {
  const [openRow, setOpenRow] = useState<string>();
  const rows = columns.map((c) => factsOf(c, summary));
  let no = 0;
  const numbered = new Map(rows.map((f) => [f.column.rowId, ++no]));
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <TableMarkup.Root className="w-full border-separate border-spacing-0 text-sm">
          <TableMarkup.Head>
            <TableMarkup.Row className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <TableMarkup.HeaderCell className="w-16 whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left">No</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className="w-40 whitespace-nowrap border-b border-slate-200 px-4 py-3">SOP No</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Subject / SOP title</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className="w-40 whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left">Annual training</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className="w-64 whitespace-nowrap border-b border-slate-200 px-4 py-3">Completion</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className="w-[26rem] whitespace-nowrap border-b border-slate-200 px-4 py-3">Still to be trained</TableMarkup.HeaderCell>
              <TableMarkup.HeaderCell className="w-10 border-b border-slate-200" />
            </TableMarkup.Row>
          </TableMarkup.Head>
          <TableMarkup.Body>
            {GROUPS.map((g) => {
              const part = rows.filter((f) => f.column.group === g.id);
              if (part.length === 0) return null;
              return (
                <Fragment key={g.id}>
                  <TableMarkup.Row><TableMarkup.Cell colSpan={7} className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-2"><span className="text-sm font-semibold text-emerald-900">{g.title}</span><span className="ml-2 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-800">{part.length}</span></TableMarkup.Cell></TableMarkup.Row>
                  {part.map((f) => {
                    const id = f.column.rowId;
                    const expanded = openRow === id;
                    const canOpen = f.openTotal > 0;
                    return (
                      <Fragment key={id}>
                        <TableMarkup.Row className={`group ${canOpen ? "cursor-pointer" : ""} hover:bg-slate-50`} onClick={() => canOpen && setOpenRow(expanded ? undefined : id)}>
                          <TableMarkup.Cell className="border-b border-slate-100 px-4 py-3.5 text-center text-xs tabular-nums text-slate-500">{numbered.get(id)}</TableMarkup.Cell>
                          <TableMarkup.Cell className="border-b border-slate-100 px-4 py-3.5 text-xs font-medium text-slate-700">{f.column.code ?? ""}</TableMarkup.Cell>
                          <TableMarkup.Cell className="border-b border-slate-100 px-4 py-3.5 font-medium leading-snug text-slate-900">{f.column.title}</TableMarkup.Cell>
                          <TableMarkup.Cell className="border-b border-slate-100 px-4 py-3.5 text-center"><Annual yes={f.column.annual} /></TableMarkup.Cell>
                          <TableMarkup.Cell className="border-b border-slate-100 px-4 py-3.5"><RowBar facts={f} /></TableMarkup.Cell>
                          <TableMarkup.Cell className="border-b border-slate-100 px-4 py-3.5">
                            {expanded ? <span className="text-xs text-slate-500">{f.openTotal} people, listed below</span> : <OpenSummary facts={f} />}
                          </TableMarkup.Cell>
                          <TableMarkup.Cell className="border-b border-slate-100 pr-2 text-slate-400">
                            {canOpen && (
                              <button type="button" aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} the people still to be trained on ${f.column.title}`} onClick={(e) => { e.stopPropagation(); setOpenRow(expanded ? undefined : id); }} className="rounded p-1 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                          </TableMarkup.Cell>
                        </TableMarkup.Row>
                        {expanded && <TableMarkup.Row><TableMarkup.Cell colSpan={7} className="border-b border-slate-100 bg-slate-50/60 px-6 py-3"><OpenPeople facts={f} /></TableMarkup.Cell></TableMarkup.Row>}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </TableMarkup.Body>
        </TableMarkup.Root>
      </div>

      <div className="space-y-4 md:hidden">
        {GROUPS.map((g) => {
          const part = rows.filter((f) => f.column.group === g.id);
          if (part.length === 0) return null;
          return (
            <section key={g.id} className="space-y-2">
              <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">{g.title} <span className="font-normal text-slate-500">({part.length})</span></h4>
              {part.map((f) => {
                const id = f.column.rowId;
                const expanded = openRow === id;
                return (
                  <div key={id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><div className="text-xs text-slate-500">{numbered.get(id)}. {f.column.code ?? ""}</div><div className="text-sm font-medium leading-snug text-slate-900">{f.column.title}</div></div>
                      <Annual yes={f.column.annual} />
                    </div>
                    <div className="mt-2"><RowBar facts={f} /></div>
                    <div className="mt-2">
                      {f.openTotal === 0 ? <OpenPeople facts={f} /> : (
                        <>
                          <button type="button" aria-expanded={expanded} onClick={() => setOpenRow(expanded ? undefined : id)} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                            <span>{f.openTotal} still to be trained</span>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          {expanded && <div className="mt-2"><OpenPeople facts={f} /></div>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** The first names of those still to be trained, so a row can be read without opening it. */
function OpenSummary({ facts }: { facts: RowFacts }) {
  if (facts.openTotal === 0) return <OpenPeople facts={facts} />;
  const shown = facts.open.slice(0, 2);
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="People still to be trained">
      {shown.map((p) => <PersonChip key={p.personId} name={p.fullName} code={null} status={p.status as CompletionState} />)}
      {facts.openTotal > shown.length && <li className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">+{facts.openTotal - shown.length}</li>}
    </ul>
  );
}

/** Totals of the position, from the server: the people, those ready for a work assignment, those with a gap, and the rows everyone has finished. */
export function CompletionSummaryStrip({ summary, columns }: { summary?: CompletionSummary; columns: CompletionColumn[] }) {
  if (!summary) return null;
  const facts = columns.map((c) => factsOf(c, summary));
  const rowsDone = facts.filter((f) => f.required > 0 && f.openTotal === 0).length;
  const tiles = [
    { label: "People in the position", value: summary.people, tone: "text-slate-900" },
    { label: "Ready for a work assignment", value: `${summary.ready} / ${summary.people}`, tone: "text-emerald-700", hint: "Trained on every row of the matrix" },
    { label: "People with a gap", value: summary.withGap, tone: summary.withGap > 0 ? "text-red-700" : "text-slate-900", hint: "Required, update needed or annual due" },
    { label: "Rows everyone has finished", value: `${rowsDone} / ${facts.length}`, tone: "text-slate-900" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Totals of the position">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
          <div className="text-xs font-medium text-slate-500">{t.label}</div>
          <div className={`mt-0.5 text-2xl font-semibold leading-tight tabular-nums ${t.tone}`}>{t.value}</div>
          {t.hint && <div className="mt-0.5 text-[11px] text-slate-400">{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}
