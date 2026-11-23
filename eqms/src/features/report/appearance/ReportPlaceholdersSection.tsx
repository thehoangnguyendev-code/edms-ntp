import { useMemo, useState } from "react";
import { IconBraces, IconCopy } from "@tabler/icons-react";
import { Input } from "@/components/ui/form/ResponsiveForm";
import { FormSection } from "@/components/ui/form/FormSection";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable, TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { reportTokens } from "../templates/reportTokens";
import { tr } from "@/i18n";

type Token = (typeof reportTokens)[number];

/** The automatic fields a text can hold: a table on a wide screen, cards on a phone. The Copy button copies the field; the chips under a text on the page insert it. */
export function ReportPlaceholdersSection() {
  const mobile = useMediaQuery("(max-width: 767px)");
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const text = filter.trim().toLowerCase();
    return text ? reportTokens.filter((token) => `${token.name} ${token.code} ${token.example}`.toLowerCase().includes(text)) : reportTokens;
  }, [filter]);

  const copy = async (token: Token) => {
    try {
      await navigator.clipboard.writeText(`{{${token.code}}}`);
      setCopied(token.code);
      setCopyError("");
    } catch {
      setCopied("");
      setCopyError("Unable to copy. Select the field text and copy it manually.");
    }
  };
  const copyButton = (token: Token) => (
    <Button size="xs" variant="outline" aria-label={`Copy ${token.code}`} onClick={() => copy(token)}>
      <IconCopy className="mr-1 h-3.5 w-3.5" aria-hidden />
      {copied === token.code ? "Copied" : "Copy"}
    </Button>
  );

  const columns: DataTableColumn<Token>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_token, index) => index + 1 },
    { id: "name", header: "Name", label: "Name", cell: (token) => <span className="font-medium text-slate-900">{token.name}</span> },
    { id: "code", header: tr("Placeholder"), label: tr("Placeholder"), cell: (token) => <span translate="no" className="font-mono text-xs text-slate-700">{`{{${token.code}}}`}</span> },
    { id: "example", header: tr("Filled with"), label: tr("Filled with"), cellClassName: "max-w-md whitespace-normal", cell: (token) => <span className="text-slate-600">{token.example}</span> },
    { id: "copy", header: "Copy", label: "Copy", cell: (token) => copyButton(token) },
  ];

  return (
    <FormSection title={tr("Report Placeholders")} icon={<IconBraces className="h-4 w-4" />}>
      <div className="space-y-3">
        <Input aria-label={tr("Filter placeholders")} placeholder={tr("Filter by name or code…")} value={filter} onChange={(e) => setFilter(e.target.value)} />
        {copyError && <WarningBanner variant="error" description={copyError} />}
        {mobile ? (
          <ul className="space-y-2">
            {shown.map((token) => (
              <li key={token.code} className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium text-slate-900">{token.name}</span>
                  {copyButton(token)}
                </div>
                <p translate="no" className="break-all font-mono text-xs text-slate-700">{`{{${token.code}}}`}</p>
                <p className="text-xs text-slate-500">{token.example}</p>
              </li>
            ))}
            {shown.length === 0 && <li className="py-3 text-xs text-slate-500">{tr("No field matches.")}</li>}
          </ul>
        ) : (
          <DataTable rows={shown} columns={columns} getRowKey={(token) => token.code} emptyState={<p className="py-6 text-center text-sm text-slate-500">{tr("No field matches.")}</p>} />
        )}
      </div>
    </FormSection>
  );
}
