import { useEffect, useMemo, useRef } from 'react';
import { config } from '@/config';
import { getCatalogLanguage } from '@/i18n';

/**
 * The frame of draw.io itself, for reading only: View &gt; Read-only is switched on, the Shapes and Format panels are left out so that the drawing has the room,
 * and there is no Save or Exit button. It keeps its own settings (settingsName), apart from those of the editor. Whatever a person does here is never sent to
 * the server: this component listens for nothing but the loading of the drawing. Drawn light; nothing is sent outside the installation (stealth).
 */
export function DrawioViewer({ xml, title, className }: { xml: string; title: string; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const base = config.drawio.url.replace(/\/+$/, '');
  const origin = useMemo(() => new URL(`${base}/`, window.location.origin).origin, [base]);
  const source = useMemo(
    () => `${base}/?embed=1&proto=json&configure=1&libraries=0&sidebar=0&format=0&noSaveBtn=1&noExitBtn=1&saveAndExit=0&stealth=1&spin=1&dark=0&lang=${getCatalogLanguage() === 'vi' ? 'vi' : 'en'}`,
    [base, getCatalogLanguage()],
  );

  useEffect(() => {
    const send = (message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(JSON.stringify(message), origin);
    const listen = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      let message: { event?: string };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.event === 'configure') send({ action: 'configure', config: { settingsName: 'eqms-view' } });
      else if (message.event === 'init') send({ action: 'load', xml });
      // each opening of the frame starts able to edit: the switch is turned on once the drawing is there
      else if (message.event === 'load') send({ action: 'invokeAction', actionName: 'readOnly' });
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [origin, xml]);

  // another drawing starts the frame again, so that it asks for it
  return <iframe key={xml} ref={frame} src={source} title={title} className={className ?? 'h-full w-full border-0'} />;
}
