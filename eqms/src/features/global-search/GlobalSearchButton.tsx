import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { GlobalSearchDialog } from './GlobalSearchDialog';

/** The magnifier at the left of the bell. It opens the search box in the middle of the screen; Ctrl+K (Cmd+K) opens it from anywhere. */
export const GlobalSearchButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    // Focus goes back to where the person was.
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        aria-label="Search"
        aria-haspopup="dialog"
        title="Search (Ctrl+K)"
        className="text-slate-600 transition-colors hover:bg-transparent hover:text-emerald-600"
      >
        <Search className="h-5 w-5 md:h-6 md:w-6" />
      </Button>
      <GlobalSearchDialog isOpen={isOpen} onClose={close} />
    </>
  );
};
