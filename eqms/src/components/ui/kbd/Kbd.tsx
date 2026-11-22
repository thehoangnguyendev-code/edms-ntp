import React from 'react';
import { cn } from '@/components/ui/utils';

/** The keys a shortcut can name. Anything else is shown as typed (a letter, "/", "K"). */
export type KbdKey =
  | 'command' | 'ctrl' | 'shift' | 'option' | 'alt' | 'win' | 'mod'
  | 'enter' | 'escape' | 'delete' | 'tab' | 'space'
  | 'up' | 'down' | 'left' | 'right';

interface KeyFace {
  /** What a Mac shows: the symbol its keyboard has printed on the key. */
  mac: string;
  /** What a Windows or Linux keyboard has printed on it. */
  pc: string;
  /** The words a screen reader says. */
  name: string;
}

const FACES: Record<KbdKey, KeyFace> = {
  command: { mac: '⌘', pc: 'Win', name: 'Command' },
  ctrl: { mac: '⌃', pc: 'Ctrl', name: 'Control' },
  shift: { mac: '⇧', pc: 'Shift', name: 'Shift' },
  option: { mac: '⌥', pc: 'Alt', name: 'Option' },
  alt: { mac: '⌥', pc: 'Alt', name: 'Alt' },
  win: { mac: '⌘', pc: 'Win', name: 'Windows' },
  // The key that opens shortcuts of the app: Command on a Mac, Control elsewhere.
  mod: { mac: '⌘', pc: 'Ctrl', name: 'Command or Control' },
  enter: { mac: '↵', pc: 'Enter', name: 'Enter' },
  escape: { mac: '⎋', pc: 'Esc', name: 'Escape' },
  delete: { mac: '⌫', pc: 'Del', name: 'Delete' },
  tab: { mac: '⇥', pc: 'Tab', name: 'Tab' },
  space: { mac: '␣', pc: 'Space', name: 'Space' },
  up: { mac: '↑', pc: '↑', name: 'Up arrow' },
  down: { mac: '↓', pc: '↓', name: 'Down arrow' },
  left: { mac: '←', pc: '←', name: 'Left arrow' },
  right: { mac: '→', pc: '→', name: 'Right arrow' },
};

/** True on a Mac, an iPad or an iPhone, where the shortcuts are written with symbols. Decided once; the keyboard does not change under the page. */
export const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
};

const APPLE = isApplePlatform();

export interface KbdProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The keys pressed together, in order: `['mod', 'K']`, `['shift', 'tab']`, `['escape']`. */
  keys: ReadonlyArray<KbdKey | string>;
  /** `light` has no fill, for a key shown on a coloured or already tinted surface. */
  variant?: 'default' | 'light';
  /** `sm` (20px) for a hint line, `md` (24px) next to a field. */
  size?: 'sm' | 'md';
}

/**
 * A key of the keyboard, drawn the way HeroUI draws it (one soft cap, no border, no shadow, 24px high) and written the way the person's keyboard writes it:
 * symbols on a Mac (⌘K, ⎋, ↵), words on Windows and Linux (Ctrl+K, Esc, Enter). Display only.
 */
export const Kbd: React.FC<KbdProps> = ({ keys, variant = 'default', size = 'md', className, ...rest }) => {
  const parts = keys.map((key) => {
    const face = (FACES as Record<string, KeyFace | undefined>)[key];
    return face
      ? { text: APPLE ? face.mac : face.pc, name: face.name }
      : { text: key.length === 1 ? key.toUpperCase() : key, name: key };
  });
  // Symbols sit next to each other (⌘K); words need a plus (Ctrl+K), and a lone word needs nothing.
  const joiner = APPLE ? '' : '+';
  return (
    <kbd
      {...rest}
      aria-label={parts.map((part) => part.name).join(' ')}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-lg text-center font-sans font-medium text-slate-500',
        size === 'sm' ? 'h-5 min-w-5 justify-center px-1.5 text-2xs' : 'h-6 min-w-6 justify-center px-2 text-xs',
        variant === 'light' ? 'bg-transparent' : 'bg-slate-100',
        className,
      )}
    >
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && joiner && <span aria-hidden="true" className="px-px text-slate-400">{joiner}</span>}
          <span aria-hidden="true">{part.text}</span>
        </React.Fragment>
      ))}
    </kbd>
  );
};
