import React, { useEffect, useRef, useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { Button } from './Button';

interface CopyButtonProps {
  /** The text that goes to the clipboard. */
  value: string;
  /** What a screen reader announces, for example "Copy the object key of Documents". */
  label: string;
  className?: string;
}

/**
 * An icon button that copies `value` and shows a check for a moment. The clipboard can be unavailable (an insecure page, a refused permission): then nothing is shown as
 * copied, so the check never claims something that did not happen.
 */
export const CopyButton: React.FC<CopyButtonProps> = ({ value, label, className }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button type="button" variant="ghost" size="icon-sm" className={className} aria-label={copied ? 'Copied' : label} title={copied ? 'Copied' : label} onClick={() => void copy()}>
      {copied ? <IconCheck className="h-4 w-4 text-emerald-600" /> : <IconCopy className="h-4 w-4 text-slate-500" />}
    </Button>
  );
};
