import React, { useRef } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { gsap, prefersReducedMotion, useGSAP } from '../gsap';

describe('gsap setup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('useGSAP animates inside its scope and reverts on unmount', () => {
    const Box: React.FC = () => {
      const ref = useRef<HTMLDivElement>(null);
      useGSAP(() => { gsap.set('.item', { x: 40 }); }, { scope: ref });
      return <div ref={ref}><span className="item" data-testid="inside" /></div>;
    };
    const outside = document.createElement('span');
    outside.className = 'item';
    document.body.appendChild(outside);

    const { getByTestId, unmount } = render(<Box />);
    const inside = getByTestId('inside');
    expect(gsap.getProperty(inside, 'x')).toBe(40);
    expect(gsap.getProperty(outside, 'x')).toBe(0); // the selector stays inside the component

    unmount();
    expect(gsap.getProperty(inside, 'x')).toBe(0); // reverted
    outside.remove();
  });

  it('reads the OS motion setting, and treats a browser without it as "motion allowed"', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    expect(prefersReducedMotion()).toBe(true);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
    expect(prefersReducedMotion()).toBe(false);
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('gsapScroll setup', () => {
  type ScrollModule = typeof import('../gsapScroll');
  let mod: ScrollModule;

  beforeAll(async () => {
    // a browser always has matchMedia (ScrollTrigger reads it while registering); the test DOM does not
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    mod = await import('../gsapScroll');
  });

  it('points ScrollTrigger at the page scroll container', () => {
    expect(mod.PAGE_SCROLLER).toBe('#main-scroll-container');
    const scroller = document.createElement('div');
    scroller.id = 'main-scroll-container';
    document.body.appendChild(scroller);
    const target = document.createElement('div');
    scroller.appendChild(target);
    const trigger = mod.ScrollTrigger.create({ trigger: target });
    expect(trigger.scroller).toBe(scroller); // the default applies to every trigger
    trigger.kill();
    scroller.remove();
  });
});
