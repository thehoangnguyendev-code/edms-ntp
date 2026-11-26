import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useDebounce } from "@/hooks/useDebounce";
import { notificationPolicyApi, type NotificationTranslation } from "@/services/api/notificationPolicy";
import { tr, trFormat } from "@/i18n";
import { TokenTextField } from "./TokenTextField";
import { RichTextEditor } from "./RichTextEditor";

type Field = "title" | "summary" | "subject" | "body" | "actionLabel";
type Form = Record<Field, string>;
const EMPTY: Form = { title: "", summary: "", subject: "", body: "", actionLabel: "" };

export interface EnglishWording { title: string; summary: string; subject: string; body: string; url: string; label: string }

const placeholdersIn = (...texts: string[]) => new Set(texts.flatMap((t) => Array.from(t.matchAll(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g), (m) => m[1])));

const formOf = (next: NotificationTranslation): Form => {
  const t = next.translation;
  return { title: t?.title ?? "", summary: t?.summary ?? "", subject: t?.subject ?? "", body: t?.body ?? "", actionLabel: t?.actionLabel ?? "" };
};

/**
 * The Vietnamese wording of one channel: it is saved apart from the English wording, which stays the one everybody receives unless the reader chose Vietnamese.
 * It is saved by the screen's Save button, together with the other changes. The state lives with the screen, not with the fields, so a draft survives a change of language or of tab. The placeholders stay as in the English wording.
 */
export function useVietnameseWording({ eventCode, channel, english, opened, readOnly }: {
  eventCode: string;
  channel: "IN_APP" | "EMAIL";
  /** The saved English wording: what a translation is copied from. */
  english: EnglishWording;
  /** Nothing is read until the Vietnamese tab is opened for the first time. */
  opened: boolean;
  readOnly: boolean;
}) {
  const isEmail = channel === "EMAIL";
  const [info, setInfo] = useState<NotificationTranslation>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewText, setPreviewText] = useState({ title: "", summary: "" });
  const [confirmCopy, setConfirmCopy] = useState(false);
  // the editor gives its own markup back once when it mounts: that is the starting point, not a change
  const bodyPristine = useRef(true);
  const take = useCallback((next: NotificationTranslation) => {
    const loaded = formOf(next);
    bodyPristine.current = true;
    setInfo(next);
    setForm(loaded);
    setSaved(loaded);
  }, []);

  const fields: Field[] = isEmail ? ["subject", "body", "actionLabel"] : ["title", "summary"];
  const translatable = Boolean(info?.translatable);
  const dirty = translatable && !readOnly && fields.some((f) => form[f] !== saved[f]);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // the notification and channel this state belongs to, and the English wording it was read against
  const key = `${eventCode}/${channel}`;
  const loadedKey = useRef("");
  const englishKey = JSON.stringify([english.title, english.summary, english.subject, english.label]);
  useEffect(() => {
    if (!opened) return;
    let live = true;
    const another = loadedKey.current !== key;
    if (another) {
      setInfo(undefined);
      setForm(EMPTY);
      setSaved(EMPTY);
    }
    setFailed(false);
    notificationPolicyApi.getTranslation(eventCode, channel).then((next) => {
      if (!live) return;
      loadedKey.current = key;
      // the English wording was published while a draft was being typed: what it must keep is refreshed, the draft stays
      if (!another && dirtyRef.current) setInfo(next);
      else take(next);
    }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [opened, key, eventCode, channel, englishKey, attempt, take]);

  // the server renders the draft with the example values a Vietnamese reader would receive, so the preview shows what is really sent
  const draft = useDebounce(JSON.stringify([form.title, form.summary, form.subject, form.body, form.actionLabel]), 500);
  const url = english.url;
  useEffect(() => {
    if (!translatable) return;
    let live = true;
    const [title, summary, subject, body, actionLabel] = JSON.parse(draft) as string[];
    notificationPolicyApi
      .preview(eventCode, isEmail ? { channel: "EMAIL", subject, body, actionUrlTemplate: url, actionLabel } : { channel: "IN_APP", title, summary }, "vi")
      .then((r) => {
        if (!live) return;
        setPreviewHtml(r.renderedHtml ?? "");
        setPreviewSubject(r.renderedSubject ?? "");
        setPreviewText({ title: r.renderedTitle ?? "", summary: r.renderedSummary ?? "" });
      })
      .catch(() => live && setPreviewHtml(""));
    return () => { live = false; };
  }, [isEmail, translatable, eventCode, url, draft]);

  // the English wording as a starting point: the layout and the placeholders are already there, only the words are left to translate
  const copyEnglish = () => {
    bodyPristine.current = false;
    setForm(isEmail
      ? { ...EMPTY, subject: english.subject, body: english.body, actionLabel: english.label }
      : { ...EMPTY, title: english.title, summary: english.summary });
    setConfirmCopy(false);
  };

  const editor = ((): ReactNode => {
    if (failed) {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-700">
          {tr("The Vietnamese wording could not be loaded.")}
          <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>{tr("Try again")}</Button>
        </div>
      );
    }
    if (!info) return <SectionLoading minHeight="200px" />;
    if (!info.translatable) {
      return (
        <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {tr("There is no English wording to translate yet.")}
        </p>
      );
    }

    const required = info.requiredPlaceholders ?? [];
    const set = (name: Field) => (value: string) => setForm((f) => ({ ...f, [name]: value }));
    const field = (name: Exclude<Field, "body">, label: string, max: number, multiline = false) => (
      <FormField label={label} htmlFor={`vi-${name}`}>
        <TokenTextField id={`vi-${name}`} ariaLabel={label} value={form[name]} onChange={set(name)} allowedTokens={required}
          maxLength={max} multiline={multiline} rows={multiline ? 3 : undefined} disabled={readOnly} />
      </FormField>
    );

    return (
      <div className="space-y-4">
        {info.translation?.outdated && (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {tr("The English wording changed after this translation was saved. English is sent to everybody until you check the translation and save it again.")}
          </p>
        )}
        {!info.translation && (
          <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {tr("No Vietnamese wording yet: everybody receives the English wording.")}
          </p>
        )}
        {!readOnly && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => (fields.some((f) => form[f].trim()) ? setConfirmCopy(true) : copyEnglish())}>
            <Copy className="h-4 w-4" />
            {tr("Copy from English")}
          </Button>
        )}
        <AlertModal isOpen={confirmCopy} onClose={() => setConfirmCopy(false)} onConfirm={copyEnglish} type="warning" showCancel
          title={tr("Replace the Vietnamese text?")} description={tr("The fields are filled with the English wording again. What you typed in them is replaced; nothing is saved yet.")}
          confirmText={tr("Replace")} cancelText={tr("Cancel")} />
        {isEmail ? (
          <>
            {field("subject", tr("Subject"), 255)}
            <FormField label={tr("Message")}>
              <RichTextEditor ariaLabel={tr("Message")} value={form.body} allowedTokens={required} disabled={readOnly}
                onChange={(value) => { setForm((f) => ({ ...f, body: value })); if (bodyPristine.current) setSaved((f) => ({ ...f, body: value })); }}
                onFocus={() => { bodyPristine.current = false; }} placeholder={tr("Write the message of the email…")} />
            </FormField>
            {field("actionLabel", tr("Button label"), 80)}
          </>
        ) : (
          <>
            {field("title", tr("Title"), 255)}
            {field("summary", tr("Message"), 500, true)}
          </>
        )}
      </div>
    );
  })();

  /** An outdated translation can be published again unchanged: that is how the person says it still matches the new English wording. */
  const outdated = translatable && !readOnly && Boolean(info?.translation?.outdated);

  /** Why the draft cannot be published, checked before anything is published; null when it can. The placeholders are those of the English wording being published. */
  const problem = (publishedEnglish: EnglishWording): string | null => {
    const complete = isEmail
      ? Boolean(form.subject.trim() && form.body.trim() && (!publishedEnglish.label.trim() || form.actionLabel.trim()))
      : Boolean(form.title.trim() && form.summary.trim());
    if (!complete) {
      return isEmail
        ? tr("The Vietnamese wording needs a subject, a message and the button label.")
        : tr("The Vietnamese wording needs a title and a message.");
    }
    const wanted = placeholdersIn(...(isEmail ? [publishedEnglish.subject, publishedEnglish.body, publishedEnglish.label] : [publishedEnglish.title, publishedEnglish.summary]));
    const used = placeholdersIn(...fields.map((f) => form[f]));
    const braces = (names: string[]) => names.map((n) => `{{${n}}}`).join(", ");
    const missing = [...wanted].filter((n) => !used.has(n));
    if (missing.length) return trFormat("The Vietnamese wording is missing these placeholders of the English wording: {names}", { names: braces(missing) });
    const extra = [...used].filter((n) => !wanted.has(n));
    return extra.length ? trFormat("The Vietnamese wording uses placeholders the English wording does not use: {names}", { names: braces(extra) }) : null;
  };

  /** Saves the draft; throws what the server refused. After English was published in the same action it is attached to the new English version. */
  const publish = async (englishJustPublished: boolean) => {
    // otherwise the version the person translated from is sent, so that a change made meanwhile by someone else is refused
    const baseVersionId = englishJustPublished ? (await notificationPolicyApi.getTranslation(eventCode, channel)).baseVersionId : info?.baseVersionId;
    take(await notificationPolicyApi.saveTranslation(eventCode, channel, {
      baseVersionId: baseVersionId!,
      ...(isEmail ? { subject: form.subject, body: form.body, actionLabel: form.actionLabel } : { title: form.title, summary: form.summary }),
    }));
  };

  const discard = () => {
    bodyPristine.current = true;
    setForm(saved);
  };

  return {
    editor,
    dirty,
    outdated,
    problem,
    publish,
    discard,
    /** False while loading and when there is nothing to translate: the preview then shows what a Vietnamese reader receives, the English wording. */
    translatable,
    /** The title and message of the draft as a reader would see them. */
    shown: previewText,
    previewHtml,
    previewSubject,
  };
}
