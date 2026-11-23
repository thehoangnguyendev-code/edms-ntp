import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { defaultApprovalColumns, defaultReportMark, effectiveReportFrame, type ReportLayout, type ReportPlace, type ReportSlot, type ReportTextStyle } from "@/services/api/reportTemplates";
import { logoPlace, type ZoneKey } from "./ReportZonePanels";
import { fillSample } from "./reportSampleValues";
import { effectiveBold, legacyBold } from "./ReportTextStyleFields";
import { tr, trFormat } from "@/i18n";

const ReportMarkOverlay = lazy(() => import("./ReportMarkOverlay"));

/** The fonts of the report as CSS stacks (the server draws them from files; this is only how the preview looks). */
const FONT_STACK: Record<string, string> = {
  NOTO_SANS: '"Noto Sans", Inter, system-ui, sans-serif',
  NOTO_SERIF: '"Noto Serif", Georgia, serif',
  TIMES_NEW_ROMAN: '"Times New Roman", Tinos, serif',
  ROBOTO_MONO: '"Roboto Mono", ui-monospace, monospace',
  OSWALD: "Oswald, Impact, sans-serif",
};
const SAMPLE_ROWS = [
  ["SOP.100", "Validation of analytical methods", "Active", "Quality Control"],
  ["SOP.101", "Cleaning of production line B", "Active", "Production"],
  ["SOP.102", "Deviation handling", "Active", "Quality Assurance"],
  ["SOP.103", "Change control", "Active", "Quality Assurance"],
  ["SOP.104", "Equipment calibration", "Active", "Engineering"],
  ["SOP.105", "Environmental monitoring", "Active", "QC Micro"],
  ["SOP.106", "Supplier qualification", "Active", "Purchasing"],
  ["SOP.107", "Training records", "Active", "Quality Assurance"],
];
const PLACES: ReportPlace[] = ["LEFT", "CENTER", "RIGHT"];
const ZONE_OF_PLACE = (header: boolean, place: ReportPlace): ZoneKey => (header ? { LEFT: "hl", CENTER: "hc", RIGHT: "hr" } : { LEFT: "fl", CENTER: "fc", RIGHT: "fr" })[place] as ZoneKey;

/**
 * The page of the report drawn here, in the browser, from the layout that is being edited: a change in any field shows at once, with no round trip to the server. It
 * is the same geometry as the server's page (points: the margins, the header band, the rows of information, the footer), with sample values in the fields, so it
 * is close, not identical; the exact page is the server's, one click away. Click a part to edit it; drag the logo along the header into a place; drag the watermark and
 * the stamp where they should be. (REPORT-APPEARANCE-2026-11-14)
 */
export function ReportLiveSheet({
  layout,
  page,
  tablePage,
  closingPage,
  selected,
  hot,
  disabled,
  onSelect,
  onChange,
}: {
  layout: ReportLayout;
  page: number;
  tablePage: number;
  closingPage: number;
  selected: ZoneKey | null;
  hot: ZoneKey[];
  disabled: boolean;
  onSelect: (zone: ZoneKey) => void;
  onChange: (value: ReportLayout) => void;
}) {
  const frame = effectiveReportFrame(layout);
  const portrait = layout.orientation === "PORTRAIT";
  const pageWidth = portrait ? 595 : 842;
  const pageHeight = portrait ? 842 : 595;
  const sheet = useRef<HTMLDivElement>(null);
  const [dragSlot, setDragSlot] = useState<ReportPlace | null>(null);
  const [sheetWidth, setSheetWidth] = useState(0);
  const company = frame.companyName;
  const fill = (text: string) => fillSample(text, company, page, 2);
  const u = (points: number) => `calc(var(--u) * ${points})`;
  const reportFont = layout.fontFamily ?? "NOTO_SANS";
  /** The look of a text with a style: the family, size, colour, weight, slant, underline and alignment it was given; nothing is set for a text with no style. */
  const textCss = (style: ReportTextStyle | null | undefined, size?: number): React.CSSProperties => {
    if (!style) return size ? { fontSize: u(size) } : {};
    return {
      fontFamily: style.font ? FONT_STACK[style.font] : undefined,
      fontSize: u(style.size ?? size ?? 9),
      color: style.color ?? undefined,
      fontWeight: style.bold != null || style.font ? (effectiveBold(style, reportFont) ? 700 : 400) : undefined,
      fontStyle: style.italic ? "italic" : undefined,
      textDecoration: style.underline ? "underline" : undefined,
      textAlign: style.align ? (style.align.toLowerCase() as "left" | "center" | "right") : undefined,
      textTransform: style.transform ? (style.transform.toLowerCase() as "uppercase" | "lowercase" | "capitalize") : undefined,
    };
  };
  const logo = layout.logo;
  const showLogo = !!logo?.enabled && !!logo.data && (page === 1 || logo.pages === "ALL");
  const slotOfLogo = logo ? logoPlace(logo) : "LEFT";
  const isCover = layout.cover && page === 1;
  const isTable = page === tablePage;
  const isClosing = page === closingPage && (frame.approval || frame.notes);

  const zoneStyle = (zone: ZoneKey): React.CSSProperties => {
    const active = selected === zone;
    const warm = hot.includes(zone);
    return {
      outline: active ? `${u(1.2)} solid #059669` : warm ? `${u(0.8)} solid #6ee7b7` : undefined,
      outlineOffset: u(1),
      background: active ? "rgba(5,150,105,.08)" : warm ? "rgba(5,150,105,.04)" : undefined,
      borderRadius: u(2),
      cursor: "pointer",
    };
  };
  const zoneProps = (zone: ZoneKey, label: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": selected === zone,
    onClick: () => onSelect(zone),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(zone);
      }
    },
    style: zoneStyle(zone),
    className: "hover:outline hover:outline-1 hover:outline-dashed hover:outline-emerald-500",
  });

  const lines = (slot: ReportSlot) => (slot.enabled === false ? "" : fill(slot.text)).split("\n").filter((line) => line.trim() !== "");
  const cell = (header: boolean, place: ReportPlace) => {
    const zone = ZONE_OF_PLACE(header, place);
    const slot = (header ? { LEFT: frame.headerLeft, CENTER: frame.headerCenter, RIGHT: frame.headerRight } : { LEFT: frame.footerLeft, CENTER: frame.footerCenter, RIGHT: frame.footerRight })[place];
    const size = slot.size ?? (header ? 9 : 7);
    const align = place === "LEFT" ? "flex-start" : place === "CENTER" ? "center" : "flex-end";
    const rows = lines(slot);
    if (!header && place === "RIGHT" && layout.pageNumbers) rows.push(`${page} / 2`);
    return (
      <div key={place} style={{ display: "flex", flexDirection: "column", alignItems: align, gap: u(3), minWidth: 0 }}>
        {header && showLogo && slotOfLogo === place && (
          <img
            src={logo!.data}
            alt="Logo"
            draggable={false}
            onPointerDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              onSelect("logo");
              setDragSlot(place);
            }}
            onPointerMove={(e) => {
              if (dragSlot === null || !sheet.current) return;
              const rect = sheet.current.getBoundingClientRect();
              const fraction = (e.clientX - rect.left) / rect.width;
              setDragSlot(fraction < 1 / 3 ? "LEFT" : fraction < 2 / 3 ? "CENTER" : "RIGHT");
            }}
            onPointerUp={() => {
              if (dragSlot !== null && logo) onChange({ ...layout, logo: { ...logo, slot: dragSlot } });
              setDragSlot(null);
            }}
            style={{
              width: `min(${logo!.width}cqw, ${u(Math.round((pageWidth - 60) / 3))})`,
              maxHeight: u(70),
              objectFit: "contain",
              cursor: disabled ? "default" : "grab",
              touchAction: "none",
              outline: selected === "logo" ? `${u(1.2)} solid #059669` : undefined,
              outlineOffset: u(1),
            }}
          />
        )}
        <div {...zoneProps(zone, `${header ? "Header" : "Footer"} ${place.toLowerCase().replace("center", "centre")} of the page`)} style={{ ...zoneStyle(zone), width: "100%", minHeight: u(header ? 14 : 10), display: "flex", flexDirection: "column", alignItems: align, textAlign: place === "LEFT" ? "left" : place === "CENTER" ? "center" : "right", padding: `${u(1)} ${u(2)}` }}>
          {rows.map((row, index) => (
            <div key={index} style={{ fontSize: u(size), lineHeight: 1.25, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "100%", ...textCss(slot.style && { ...slot.style, size: slot.size ?? slot.style.size ?? size, align: null }) }}>
              {row}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // the places that the logo can be dropped into show while it is dragged
  const slotGuide = dragSlot && (
    <div style={{ position: "absolute", top: 0, left: u(30), right: u(30), height: u(86), display: "grid", gridTemplateColumns: "repeat(3, 1fr)", pointerEvents: "none" }}>
      {PLACES.map((place) => (
        <div key={place} style={{ border: `${u(0.8)} dashed #059669`, background: dragSlot === place ? "rgba(5,150,105,.14)" : "rgba(5,150,105,.04)" }} />
      ))}
    </div>
  );

  // The watermark and the stamp are drawn as plain marks until one of them is chosen; then Konva takes the page over them, as in the PDF Marking of a Controlled Copy:
  // drag, resize (and turn the watermark) with the handles. The place is kept as a percentage of the page, as the server keeps it.
  const mark = layout.watermarkStyle ?? defaultReportMark();
  const stamp = layout.stampStyle;
  const wmShown = layout.watermarkEnabled && (page === 1 || mark.pages === "ALL");
  const stampShown = layout.stampEnabled && (page === 1 || (stamp?.pages ?? "ALL") === "ALL");
  const stampAt = stamp?.x != null && stamp?.y != null ? { x: stamp.x, y: stamp.y } : null;
  const editingMarks = !disabled && (selected === "wm" || selected === "stamp") && (wmShown || stampShown) && sheetWidth > 0;
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setSheetWidth(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const body = isCover ? (
    <div style={{ marginTop: u(120), display: "grid", gap: u(14) }}>
      <div style={{ fontSize: u(22), fontWeight: 700, ...textCss(layout.coverTitleStyle, 22) }}>{fill(layout.coverTitle)}</div>
      <div style={{ fontSize: u(12), color: "#475569", ...textCss(layout.coverSubtitleStyle, 12) }}>{fill(layout.subtitle)}</div>
      {layout.showExecutor && <div style={{ fontSize: u(11) }}>{tr("Prepared by:")} {fillSample("{{report.executor}}", company, page, 2)}</div>}
      {layout.showGeneratedAt && <div style={{ fontSize: u(11) }}>{tr("Generated at (UTC+7):")} {fillSample("{{report.generatedAt}}", company, page, 2)}</div>}
    </div>
  ) : isClosing ? (
    <div style={{ display: "grid", gap: u(12) }}>
      {frame.approval && (
        <div {...zoneProps("appr", "Approval block of the page")} style={{ ...zoneStyle("appr"), padding: u(4) }}>
          <div style={{ fontSize: u(11), fontWeight: 600, marginBottom: u(10), ...textCss(frame.approvalStyle && { ...frame.approvalStyle, size: (frame.approvalStyle.size ?? 9) + 2 }, 11) }}>{tr("Approval")}</div>
          {(() => {
            const shown = (frame.approvalColumns?.length ? frame.approvalColumns : defaultApprovalColumns()).filter((column) => column.enabled !== false);
            const weights = [0.2, 0.26, 0.22, 0.16];
            const shares = shown.map((_, index) => weights[index] ?? 0.2);
            const total = shares.reduce((sum, value) => sum + value, 0) || 1;
            const last = shown.length;
            const justify = { LEFT: "flex-start", CENTER: "center", RIGHT: "flex-end" } as const;
            const cell = (key: string, content: string, column: number, height: number, bottom: boolean, align: "LEFT" | "CENTER" | "RIGHT" = "LEFT") => (
              <div key={key} style={{ height: u(height), padding: `0 ${u(4)}`, display: "flex", alignItems: "center", justifyContent: justify[align], overflow: "hidden", borderRight: column < last ? `${u(0.5)} solid #0f172a` : undefined, borderBottom: bottom ? `${u(0.5)} solid #0f172a` : undefined }}>
                {content}
              </div>
            );
            const roles = frame.approvalRoles?.length ? frame.approvalRoles : ["Prepared by", "Reviewed by", "Approved by"];
            return (
              <div style={{ display: "grid", gridTemplateColumns: `16fr ${shares.map((share) => `${((share / total) * 84).toFixed(2)}fr`).join(" ")}`, border: `${u(0.5)} solid #0f172a`, ...textCss(frame.approvalStyle, 9) }}>
                {["", ...shown.map((column) => column.label)].map((name, column) => cell(`h${column}`, name, column, 22, true, column === 0 ? "LEFT" : (shown[column - 1].align ?? "LEFT")))}
                {roles.flatMap((role, row) => [role, ...shown.map(() => "")].map((value, column) => cell(`${row}-${column}`, value, column, 30, row < roles.length - 1, column === 0 ? (frame.approvalStyle?.align ?? "LEFT") : "LEFT")))}
              </div>
            );
          })()}
        </div>
      )}
      {frame.notes && (
        <div {...zoneProps("notes", "Notes box of the page")} style={{ ...zoneStyle("notes"), padding: u(4) }}>
          <div style={{ fontSize: u(9), marginBottom: u(4), ...textCss(frame.notesStyle, 9) }}>{tr("Notes / Comments")}</div>
          <div style={{ border: `${u(0.75)} solid #94a3b8`, height: u(frame.notesHeight) }} />
        </div>
      )}
    </div>
  ) : (
    <>
      {isTable && frame.info.length > 0 && (
        <div {...zoneProps("info", "Information above the table")} style={{ ...zoneStyle("info"), padding: `${u(3)} 0`, marginBottom: u(6), borderBottom: `${u(0.5)} solid #cbd5e1` }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${frame.infoColumns}, minmax(0, 1fr))`, gridAutoFlow: "column", gridTemplateRows: `repeat(${Math.ceil(frame.info.length / frame.infoColumns)}, auto)`, columnGap: u(20) }}>
            {frame.info.map((item, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: `${u(frame.infoColumns === 1 ? 120 : 100)} minmax(0, 1fr)`, fontSize: u(8), lineHeight: `${u(13)}` }}>
                <span style={{ color: "#475569", ...textCss(frame.infoLabelStyle, 8) }}>{fill(item.label)}:</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...textCss(frame.infoValueStyle, 8) }}>{fill(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {isTable && (
        <div style={{ fontSize: u(8) }}>
          <div style={{ fontWeight: 700, marginBottom: u(2) }}>{tr("Metadata report • Page")} {page}</div>
          {[["Number", "Name", "Status", "Department"], ...SAMPLE_ROWS].map((row, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 2.4fr 0.8fr 1.2fr", gap: u(10), padding: `${u(3)} ${u(4)}`, borderBottom: `${u(index === 0 ? 0.6 : 0.25)} solid ${index === 0 ? "#64748b" : "#cbd5e1"}` }}>
              {row.map((value, column) => (
                <span key={column} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      ref={sheet}
      data-testid="live-sheet"
      style={{
        containerType: "inline-size",
        ["--u" as string]: `${100 / pageWidth}cqw`,
        position: "relative",
        width: "100%",
        maxWidth: portrait ? "70%" : undefined,
        margin: portrait ? "0 auto" : undefined,
        aspectRatio: `${pageWidth} / ${pageHeight}`,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(15,23,42,.18), 0 8px 24px rgba(15,23,42,.08)",
        overflow: "hidden",
        color: "#0f172a",
        // The bundled Noto, Roboto Mono and Oswald files of a report are bold, so the report is bold unless a text sets otherwise; Times New Roman is regular.
        fontWeight: legacyBold(layout.fontFamily ?? "NOTO_SANS") ? 700 : 400,
        fontFamily: FONT_STACK[layout.fontFamily ?? "NOTO_SANS"] ?? FONT_STACK.NOTO_SANS,
        userSelect: "none",
      }}
    >
      <div style={{ position: "absolute", inset: 0, padding: `0 ${u(30)}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: u(6), padding: `${u(8)} 0`, borderBottom: `${u(0.6)} solid #cbd5e1`, marginBottom: u(10) }}>
          {PLACES.map((place) => cell(true, place))}
        </div>
        {body}
      </div>
      {slotGuide}
      <div style={{ position: "absolute", left: u(30), right: u(30), bottom: u(8 + 20), fontSize: u(7), color: "#64748b" }}>{fill("{{report.gmpNotice}}")}</div>
      <div style={{ position: "absolute", left: u(30), right: u(30), bottom: u(8), display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: u(6), borderTop: `${u(0.6)} solid #cbd5e1`, paddingTop: u(3) }}>
        {PLACES.map((place) => cell(false, place))}
      </div>
      {!editingMarks && wmShown && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect("wm")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect("wm")}
          aria-label={tr("Watermark on the page")}
          style={{ position: "absolute", left: `${mark.x}%`, top: `${mark.y}%`, transformOrigin: "left bottom", transform: `rotate(${-mark.rotation}deg) translateY(-100%)`, fontSize: u(mark.fontSize), fontWeight: 800, whiteSpace: "nowrap", color: mark.color, opacity: mark.opacity / 100, cursor: "pointer", outline: selected === "wm" ? `${u(1)} dashed #059669` : undefined }}
        >
          {layout.watermark}
        </div>
      )}
      {!editingMarks && stampShown && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect("stamp")}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect("stamp")}
          aria-label={tr("Stamp on the page")}
          style={{ position: "absolute", ...(stampAt ? { left: `${stampAt.x}%`, top: `${stampAt.y}%` } : { right: u(30), top: u(8) }), padding: `${u(3)} ${u(10)}`, border: `${u(1.5)} solid ${stamp?.color ?? "#059669"}`, color: stamp?.color ?? "#059669", opacity: (stamp?.opacity ?? 90) / 100, fontSize: u(10), fontWeight: 800, letterSpacing: u(1), borderRadius: u(3), cursor: "pointer", background: "rgba(255,255,255,.6)" }}
        >
          {layout.stamp}
        </div>
      )}
      {editingMarks && (
        <Suspense fallback={null}>
          <ReportMarkOverlay
            layout={layout}
            width={sheetWidth}
            pageWidth={pageWidth}
            pageHeight={pageHeight}
            watermarkShown={wmShown}
            stampShown={stampShown}
            selected={selected === "wm" || selected === "stamp" ? selected : null}
            fontFamily={FONT_STACK[layout.fontFamily ?? "NOTO_SANS"] ?? FONT_STACK.NOTO_SANS}
            onSelect={onSelect}
            onChange={onChange}
          />
        </Suspense>
      )}
    </div>
  );
}
