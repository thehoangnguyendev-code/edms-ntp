import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ATTRIBUTE = 'data-readonly-visual-focus';
const SELECTOR = 'input[readonly]:disabled, textarea[readonly]:disabled, select:disabled, button[role="combobox"]:disabled, button[aria-haspopup="dialog"]:disabled';

/** Disabled controls cannot receive native focus. This only paints their focus border;
 * it never enables, focuses, forwards clicks to, or changes the value of a control. */
export function ReadonlyFocusIndicator() {
  const { pathname } = useLocation();

  useEffect(() => {
    let highlighted: Element | null = null;
    const clear = () => {
      highlighted?.removeAttribute(ATTRIBUTE);
      highlighted = null;
    };
    const point = (event: PointerEvent) => {
      if (event.button > 0) return;
      clear();
      const target = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
      if (target) {
        highlighted = target;
        highlighted.setAttribute(ATTRIBUTE, 'true');
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape') clear();
    };
    const focus = (event: FocusEvent) => {
      // Chrome can focus the surrounding scroll container after a disabled
      // field is clicked. That is still the same pointer selection.
      if (highlighted && event.target instanceof Element && event.target.contains(highlighted)) return;
      clear();
    };
    document.addEventListener('pointerdown', point, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('blur', clear);
    return () => {
      clear();
      document.removeEventListener('pointerdown', point, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', clear);
    };
  }, [pathname]);

  return null;
}
