import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MotionStrengthProvider,
  useMotionStrength,
  useMotionStrengthSetter,
} from '@/lib/motion/motionStrength';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockLocalStorage() {
  let store: Record<string, string> = {};
  const storage = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

function StrengthValue() {
  const strength = useMotionStrength();
  return <div data-testid="strength">{strength}</div>;
}

function StrengthControls() {
  const strength = useMotionStrength();
  const { setStrength } = useMotionStrengthSetter();

  return (
    <div>
      <div data-testid="strength">{strength}</div>
      <button type="button" onClick={() => setStrength(0.5)}>
        half
      </button>
      <button type="button" onClick={() => setStrength(0)}>
        zero
      </button>
      <button type="button" onClick={() => setStrength(2)}>
        too high
      </button>
      <button type="button" onClick={() => setStrength(-1)}>
        too low
      </button>
    </div>
  );
}

describe('MotionStrengthProvider', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('defaults to 1.0 when no stored value and prefers-reduced-motion is no-preference', async () => {
    mockMatchMedia(false);

    render(
      <MotionStrengthProvider>
        <StrengthValue />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('1'));
  });

  it('defaults to 0.05 when no stored value and prefers-reduced-motion is reduce', async () => {
    mockMatchMedia(true);

    render(
      <MotionStrengthProvider>
        <StrengthValue />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0.05'));
  });

  it('persists explicit strength changes and updates consumers', async () => {
    mockMatchMedia(false);

    render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'half' }));

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0.5'));
    expect(localStorage.getItem('governada_motion_strength')).toBe('0.5');
  });

  it('clamps explicit strength changes to the 0.0-1.0 range', async () => {
    mockMatchMedia(false);

    render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'too high' }));
    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('1'));

    fireEvent.click(screen.getByRole('button', { name: 'too low' }));
    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0'));
  });

  it('persists fully suspended motion and restores it after remount', async () => {
    mockMatchMedia(false);

    const { unmount } = render(
      <MotionStrengthProvider>
        <StrengthControls />
      </MotionStrengthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'zero' }));

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0'));
    expect(localStorage.getItem('governada_motion_strength')).toBe('0');

    unmount();

    render(
      <MotionStrengthProvider>
        <StrengthValue />
      </MotionStrengthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('strength').textContent).toBe('0'));
  });
});
