import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeOverlayPosition, preferredScrollBehavior } from '../scroll';

let frames: Map<number, FrameRequestCallback>;
let id = 0;
let stop: (() => void) | undefined;
const paint = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); };
beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((key: number) => frames.delete(key)));
});
afterEach(() => { stop?.(); stop = undefined; document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('overlay scroll scheduling', () => {
  it('batches ancestor scrolling and window resizing into one measurement per frame', () => {
    const ancestor = document.createElement('div');
    const anchor = document.createElement('button');
    ancestor.append(anchor); document.body.append(ancestor);
    const update = vi.fn();
    stop = observeOverlayPosition(() => anchor, update);
    for (let i = 0; i < 30; i++) ancestor.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(update).not.toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    paint();
    expect(update).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('scroll'));
    paint();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('does not measure the trigger while its portaled options or another panel scroll', () => {
    const anchor = document.createElement('button');
    const popup = document.createElement('div');
    const options = document.createElement('div');
    popup.append(options); document.body.append(anchor, popup);
    const update = vi.fn();
    stop = observeOverlayPosition(() => anchor, update);
    options.dispatchEvent(new Event('scroll'));
    popup.dispatchEvent(new Event('scroll'));
    paint();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('removes listeners and cancels pending work when an overlay closes', () => {
    const anchor = document.createElement('button');
    const update = vi.fn();
    stop = observeOverlayPosition(() => anchor, update);
    window.dispatchEvent(new Event('scroll'));
    stop();
    window.dispatchEvent(new Event('resize'));
    paint();
    expect(update).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('does not update a trigger removed before the queued frame', () => {
    let anchor: Element | null = document.createElement('button');
    const update = vi.fn();
    stop = observeOverlayPosition(() => anchor, update);
    window.dispatchEvent(new Event('resize'));
    anchor = null;
    paint();
    expect(update).not.toHaveBeenCalled();
  });
});

it('uses instant navigation when Reduce Motion is enabled', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  expect(preferredScrollBehavior()).toBe('instant');
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  expect(preferredScrollBehavior()).toBe('smooth');
});
