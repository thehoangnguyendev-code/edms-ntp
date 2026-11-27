import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { config } from '@/config';
import { getCatalogLanguage, tr } from '@/i18n';
import { textOfDataUri } from './workflowDiagramModel';

interface Props {
  /** The drawing to start from; empty for a new one. */
  xml: string;
  /** Called while drawing, so that the page knows there is something to save. */
  onChange: () => void;
  /** The editor has the drawing and can be asked to save. */
  onReady?: () => void;
  /** The person pressed Save, in draw.io or on the page: the drawing and its picture. */
  onSave: (drawing: { xml: string; svg: string }) => void;
  onExit: () => void;
}

export interface DrawioFrameHandle {
  /** Presses the editor's own Save (so text still being typed in a box is kept): answers through onSave. */
  save: () => void;
}

/**
 * The draw.io editor of this installation, in a frame, spoken to by its message protocol (embed mode, proto=json). Nothing is sent outside the installation
 * (stealth). Only messages of that frame, from the address of the editor, are listened to.
 */
export const DrawioFrame = forwardRef<DrawioFrameHandle, Props>(function DrawioFrame({ xml, onChange, onReady, onSave, onExit }, handle) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ xml, onChange, onReady, onSave, onExit });
  latest.current = { xml, onChange, onReady, onSave, onExit };
  /** The drawing of a save that is waiting for its picture. */
  const saving = useRef('');
  const base = config.drawio.url.replace(/\/+$/, '');
  const origin = useMemo(() => new URL(`${base}/`, window.location.origin).origin, [base]);
  const source = useMemo(
    () => `${base}/?embed=1&proto=json&spin=1&libraries=1&stealth=1&saveAndExit=0&dark=0&lang=${getCatalogLanguage() === 'vi' ? 'vi' : 'en'}`,
    [base, getCatalogLanguage()],
  );

  const send = useCallback((message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(JSON.stringify(message), origin), [origin]);

  useImperativeHandle(handle, () => ({
    save: () => { send({ action: 'invokeAction', actionName: 'save' }); },
  }), [send]);

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      let message: { event?: string; xml?: string; data?: string };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.event === 'init') send({ action: 'load', xml: latest.current.xml, autosave: 1 });
      else if (message.event === 'load') latest.current.onReady?.();
      else if (message.event === 'autosave') latest.current.onChange();
      else if (message.event === 'save') {
        saving.current = message.xml ?? '';
        send({ action: 'export', format: 'xmlsvg', theme: 'light' });
      } else if (message.event === 'export' && saving.current && message.data) {
        latest.current.onSave({ xml: saving.current, svg: textOfDataUri(message.data) });
        saving.current = '';
      } else if (message.event === 'exit') latest.current.onExit();
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [origin, send]);

  return <iframe ref={frame} src={source} title={tr('Diagram editor')} className="h-full w-full border-0" />;
});
