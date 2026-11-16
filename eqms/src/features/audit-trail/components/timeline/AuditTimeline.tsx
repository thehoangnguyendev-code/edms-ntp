import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconCircleX,
  IconDownload,
  IconInfoCircle,
  IconLogin2,
  IconLogout2,
  IconMessage,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconPower,
  IconRosetteDiscountCheck,
  IconRotateClockwise2,
  IconSend,
  IconServer,
  IconShieldExclamation,
  IconSparkles,
  IconTrash,
  IconUpload,
  IconUserPlus,
  IconX,
  IconEye,
  IconSignature,
} from "@tabler/icons-react";
import { Avatar as ProfileAvatar } from "@/components/ui/avatar";
import type { AuditActionKind } from "../../utils/actionKind";
import type { AuditTrailRecord } from "../../types";
import { groupByDay, type AuditTimelineItem, type AuditTimelineStyle } from "./auditTimelineModel";
import "./auditTimeline.css";

/** The room the page keeps under the panel (its footer and the footer of the panel), and the least and the most the panel is high, in pixels. */
const FOOTER_ROOM = 96;
const MIN_PANEL = 280;
const MAX_PANEL = 760;

/** One icon for each kind of action (Tabler). */
const KIND_ICON: Record<AuditActionKind, React.ElementType> = {
  create: IconPlus,
  update: IconPencil,
  approve: IconCheck,
  reject: IconX,
  submit: IconSend,
  review: IconRosetteDiscountCheck,
  publish: IconSparkles,
  login: IconLogin2,
  logout: IconLogout2,
  failed: IconShieldExclamation,
  upload: IconUpload,
  download: IconDownload,
  view: IconEye,
  delete: IconTrash,
  assign: IconUserPlus,
  disable: IconPower,
  enable: IconPlayerPlay,
  note: IconMessage,
  cancel: IconCircleX,
  restore: IconRotateClockwise2,
  system: IconServer,
};

export interface AuditTimelineProps {
  records: AuditTrailRecord[];
  style: AuditTimelineStyle;
  /** The number of records the filters match (the timeline may hold only the first pages of them). */
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenDetails: (record: AuditTrailRecord) => void;
  onExport: (record: AuditTrailRecord) => void;
}

interface MarkProps {
  item: AuditTimelineItem;
  index: number;
  onOpenDetails: (record: AuditTrailRecord) => void;
  onExport: (record: AuditTrailRecord) => void;
}

/** The picture of the person, or their initials when there is none (the shared avatar of the application, the same as on the audit detail page). */
const Avatar: React.FC<{ item: AuditTimelineItem; size: number }> = ({ item, size }) => (
  <span className="aud-av" style={{ width: size, height: size }}>
    <ProfileAvatar name={item.who} src={item.avatarUrl} className={`h-full w-full ${size <= 24 ? "text-[10px]" : "text-xs"}`} imgClassName="h-full w-full object-cover" />
  </span>
);

/** The two things a person can do with a record from the timeline, as in the menu of the table row. */
const Actions: React.FC<Pick<MarkProps, "item" | "onOpenDetails" | "onExport">> = ({ item, onOpenDetails, onExport }) => (
  <span className="aud-act">
    <button type="button" aria-label={`View details of ${item.verb} by ${item.who}`} title="View Details" onClick={() => onOpenDetails(item.record)}>
      <IconInfoCircle size={16} />
    </button>
    <button type="button" aria-label={`Export ${item.verb} by ${item.who}`} title="Export" onClick={() => onExport(item.record)}>
      <IconDownload size={16} />
    </button>
  </span>
);

const Signed: React.FC<{ item: AuditTimelineItem }> = ({ item }) =>
  item.signed ? (
    <span className="aud-sig" title="Electronically signed">
      <IconSignature size={12} />
      Signed
    </span>
  ) : null;

const Icon: React.FC<{ kind: AuditActionKind; size?: number }> = ({ kind, size = 16 }) => {
  const Component = KIND_ICON[kind];
  return <Component size={size} stroke={2} aria-hidden="true" />;
};

/* ------------------------------------------------------------------ RAIL */
const RailMark: React.FC<MarkProps> = ({ item, onOpenDetails, onExport }) => (
  <div className={`aud-ev aud-reveal aud-tone-${item.tone}`} role="listitem">
    <div className="aud-rail__dot">
      <Icon kind={item.kind} />
    </div>
    <div className="aud-rail__box" title={item.fullTime}>
      <div className="aud-rail__row">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar item={item} size={24} />
          <span className="min-w-0">
            <span className="aud-rail__who">{item.who}</span> <span className="aud-rail__what">{item.verb}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Signed item={item} />
          <Actions item={item} onOpenDetails={onOpenDetails} onExport={onExport} />
          <time className="aud-time text-xs text-slate-500">{item.time}</time>
        </div>
      </div>
      <div className="aud-rail__obj">{item.object}</div>
      {item.detail && <div className="aud-rail__det">{item.detail}</div>}
    </div>
  </div>
);

/* ---------------------------------------------------------------- CENTER */
const CenterMark: React.FC<MarkProps & { side: "left" | "right" }> = ({ item, side, onOpenDetails, onExport }) => (
  <div className={`aud-ev aud-tone-${item.tone} is-${side}`} role="listitem">
    <div className="aud-center__node aud-reveal">
      <Icon kind={item.kind} />
    </div>
    <div className="aud-center__box aud-reveal aud-reveal-x" title={item.fullTime}>
      <div className="aud-center__who">
        <Avatar item={item} size={22} />
        {item.who}
      </div>
      <div className="aud-center__what">{item.verb}</div>
      <div className="aud-center__obj">{item.object}</div>
      {item.detail && <div className="aud-center__obj">{item.detail}</div>}
      <div className="aud-center__act">
        <Signed item={item} />
        <Actions item={item} onOpenDetails={onOpenDetails} onExport={onExport} />
      </div>
    </div>
    <div className="aud-center__meta aud-reveal">
      <b>{item.time}</b>
    </div>
  </div>
);

/* --------------------------------------------------------------- COMPACT */
const CompactMark: React.FC<MarkProps> = ({ item, onOpenDetails, onExport }) => (
  <div className={`aud-ev aud-reveal aud-tone-${item.tone}`} role="listitem" title={item.fullTime}>
    <Avatar item={item} size={32} />
    <div className="aud-compact__line">
      <b>{item.who}</b>{" "}
      <span className="aud-compact__tag">
        <Icon kind={item.kind} size={12} />
        {item.verb}
      </span>{" "}
      <span>{item.object}</span>
    </div>
    <div className="aud-compact__side">
      <Signed item={item} />
      <Actions item={item} onOpenDetails={onOpenDetails} onExport={onExport} />
      <time className="aud-time">{item.time}</time>
    </div>
    <div className="aud-compact__more">
      <div>
        <p>
          <span>
            <b>Exact time</b> {item.fullTime}
          </span>
          {item.record.module && (
            <span>
              <b>Module</b> {item.record.module}
            </span>
          )}
          {item.detail && (
            <span>
              <b>Details</b> {item.detail}
            </span>
          )}
        </p>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------- SCROLL_LIT */
const LitMark: React.FC<MarkProps> = ({ item, onOpenDetails, onExport }) => (
  <div className={`aud-ev aud-reveal aud-tone-${item.tone}`} role="listitem">
    <span className="aud-lit__pin">
      <Icon kind={item.kind} size={12} />
    </span>
    <div className="aud-lit__wrap">
      <div className="aud-lit__chip">
        <div className="aud-lit__top">
          <Avatar item={item} size={24} />
          <span className="font-semibold">{item.who}</span>
          <Signed item={item} />
          <Actions item={item} onOpenDetails={onOpenDetails} onExport={onExport} />
          <time className="aud-time t">{item.time}</time>
        </div>
        <div className="aud-lit__what">
          <b>{item.verb}</b>
          {item.object}
        </div>
        {item.detail && <div className="aud-lit__what text-slate-500">{item.detail}</div>}
      </div>
      <div className="aud-lit__tip">{item.fullTime}</div>
    </div>
  </div>
);

/**
 * The records of an audit trail as a vertical timeline in a panel of its own that scrolls (the page does not): who, when, what. Marks slide in as the panel scrolls
 * to them and answer the pointer; older records load when the end of the panel is reached. Four looks, chosen by the administrator (Configuration, General).
 */
export const AuditTimeline: React.FC<AuditTimelineProps> = ({ records, style, total, isLoading, hasMore, onLoadMore, onOpenDetails, onExport }) => {
  const days = useMemo(() => groupByDay(records), [records]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // The panel takes the height that is left under it in the window, so that the panel scrolls and the page does not (never less than a few marks, never a wall).
  const [panelHeight, setPanelHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const fit = () => {
      const left = window.innerHeight - element.getBoundingClientRect().top - FOOTER_ROOM;
      setPanelHeight(Math.max(MIN_PANEL, Math.min(Math.floor(left), MAX_PANEL)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [days.length]);

  // A mark appears when the panel scrolls to it. Without IntersectionObserver (a very old browser, a test) every mark is shown at once.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const pending = Array.from(root.querySelectorAll<HTMLElement>(".aud-reveal:not(.is-in)"));
    if (typeof IntersectionObserver === "undefined") {
      pending.forEach((element) => element.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        }),
      { root, threshold: 0.12 },
    );
    pending.forEach((element, index) => {
      element.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [days, style]);

  // Older records are loaded when the end of the panel comes into view.
  useEffect(() => {
    const root = scrollerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && !isLoading && onLoadMore(), { root, rootMargin: "0px 0px 120px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore, days.length]);

  // SCROLL_LIT: the line of each day is filled down to a point a little below the middle of the panel, and the marks above it are lit.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || style !== "SCROLL_LIT") return;
    const update = () => {
      const bounds = root.getBoundingClientRect();
      const line = bounds.top + bounds.height * 0.62;
      root.querySelectorAll<HTMLElement>(".aud-lit__spine").forEach((spine) => {
        const box = spine.getBoundingClientRect();
        spine.style.setProperty("--fill", `${Math.max(0, Math.min(box.height, line - box.top))}px`);
        spine.querySelectorAll<HTMLElement>(".aud-ev").forEach((mark) => mark.classList.toggle("is-lit", mark.getBoundingClientRect().top + 14 < line));
      });
    };
    update();
    root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      root.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [days, style]);

  let counter = 0;
  return (
    <div className="aud-tl" data-style={style}>
      <div ref={scrollerRef} className="aud-tl__scroller" style={panelHeight ? { maxHeight: panelHeight, height: panelHeight } : undefined} tabIndex={0} aria-label="Audit trail timeline">
        {style === "RAIL" && (
          <div className="aud-rail" role="list">
            {days.map((day) => (
              <React.Fragment key={day.key}>
                <div className="aud-rail__day">
                  <span>
                    {day.label}
                    <em>{day.key}</em>
                    <em>· {day.items.length}</em>
                  </span>
                </div>
                {day.items.map((item, index) => (
                  <RailMark key={item.id} item={item} index={index} onOpenDetails={onOpenDetails} onExport={onExport} />
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
        {style === "CENTER" && (
          <div className="aud-center" role="list">
            {days.map((day) => (
              <React.Fragment key={day.key}>
                <div className="aud-center__day">
                  <span>
                    {day.label} · {day.key}
                  </span>
                </div>
                {day.items.map((item, index) => (
                  <CenterMark key={item.id} item={item} index={index} side={counter++ % 2 === 0 ? "left" : "right"} onOpenDetails={onOpenDetails} onExport={onExport} />
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
        {style === "COMPACT" && (
          <div className="aud-compact" role="list">
            {days.map((day) => (
              <React.Fragment key={day.key}>
                <div className="aud-compact__day">
                  {day.label} · {day.key}
                </div>
                {day.items.map((item, index) => (
                  <CompactMark key={item.id} item={item} index={index} onOpenDetails={onOpenDetails} onExport={onExport} />
                ))}
              </React.Fragment>
            ))}
          </div>
        )}
        {style === "SCROLL_LIT" && (
          <div className="aud-lit" role="list">
            {days.map((day) => (
              <section key={day.key} className="aud-lit__sec">
                <div>
                  <div className="aud-lit__stick">
                    <div className="aud-lit__d">{day.dayOfMonth}</div>
                    <div className="aud-lit__m">{day.month}</div>
                    <div className="aud-lit__w">{day.weekday}</div>
                  </div>
                </div>
                <div className="aud-lit__spine">
                  {day.items.map((item, index) => (
                    <LitMark key={item.id} item={item} index={index} onOpenDetails={onOpenDetails} onExport={onExport} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <div ref={sentinelRef} className="aud-tl__sentinel" />
      </div>
      <div className="aud-tl__foot">
        <span>
          Showing {records.length.toLocaleString()} of {total.toLocaleString()} records
        </span>
        {hasMore ? (
          <button type="button" className="font-medium text-emerald-700 hover:underline disabled:opacity-60" disabled={isLoading} onClick={onLoadMore}>
            {isLoading ? "Loading…" : "Load older records"}
          </button>
        ) : (
          <span>That is every record.</span>
        )}
      </div>
    </div>
  );
};
