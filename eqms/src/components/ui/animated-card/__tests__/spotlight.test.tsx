import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedCard } from '..';

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('AnimatedCard spotlight', () => {
  it('writes the pointer position once per frame, using the latest position, however many mouse events came', () => {
    render(<AnimatedCard tone="emerald" data-testid="card">content</AnimatedCard>);
    const card = screen.getByTestId('card');
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, right: 0, bottom: 0, width: 0, height: 0, x: 10, y: 20, toJSON: () => ({}) } as DOMRect);
    const setProperty = vi.spyOn(card.style, 'setProperty');

    for (let x = 100; x < 140; x += 1) fireEvent.mouseMove(card, { clientX: x, clientY: 70 });
    expect(frames).toHaveLength(1);
    expect(setProperty).not.toHaveBeenCalled(); // nothing is written until the frame

    act(() => frames[0](0));

    expect(setProperty).toHaveBeenCalledTimes(2);
    expect(card.style.getPropertyValue('--mx')).toBe('129px'); // last x (139) minus the card's left edge (10)
    expect(card.style.getPropertyValue('--my')).toBe('50px');
  });

  it('does nothing for a card without a tone', () => {
    render(<AnimatedCard data-testid="plain">content</AnimatedCard>);
    fireEvent.mouseMove(screen.getByTestId('plain'), { clientX: 5, clientY: 5 });
    expect(frames).toHaveLength(0);
  });

  it('still forwards the caller\'s own mouse handler for every event', () => {
    const onMouseMove = vi.fn();
    render(<AnimatedCard tone="emerald" data-testid="card" onMouseMove={onMouseMove}>content</AnimatedCard>);
    const card = screen.getByTestId('card');
    for (let i = 0; i < 5; i += 1) fireEvent.mouseMove(card, { clientX: i, clientY: i });
    expect(onMouseMove).toHaveBeenCalledTimes(5);
  });
});
