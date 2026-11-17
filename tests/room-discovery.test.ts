import { describe, expect, it, vi } from 'vitest';
import {
  hasDismissedRoomWelcome,
  isIntentionalRoomActivation,
  rememberRoomWelcomeDismissal,
  ROOM_ACTIVATION_DRAG_THRESHOLD,
  ROOM_WELCOME_STORAGE_KEY,
} from '../src/components/room/room-discovery.js';

describe('room discovery', () => {
  it('uses a versioned key to remember a dismissed welcome', () => {
    const storage = {
      getItem: vi.fn(() => 'true'),
      setItem: vi.fn(),
    };

    expect(ROOM_WELCOME_STORAGE_KEY).toBe('adrroom-welcome-dismissed-v1');
    expect(hasDismissedRoomWelcome(storage)).toBe(true);
    rememberRoomWelcomeDismissal(storage);
    expect(storage.getItem).toHaveBeenCalledWith(ROOM_WELCOME_STORAGE_KEY);
    expect(storage.setItem).toHaveBeenCalledWith(ROOM_WELCOME_STORAGE_KEY, 'true');
  });

  it('keeps discovery usable when storage is unavailable or throws', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('Storage is blocked'); }),
      setItem: vi.fn(() => { throw new Error('Storage is blocked'); }),
    };

    expect(hasDismissedRoomWelcome()).toBe(false);
    expect(hasDismissedRoomWelcome(storage)).toBe(false);
    expect(() => rememberRoomWelcomeDismissal(storage)).not.toThrow();
  });

  it('accepts deliberate clicks but rejects orbit drags', () => {
    expect(isIntentionalRoomActivation(0)).toBe(true);
    expect(isIntentionalRoomActivation(ROOM_ACTIVATION_DRAG_THRESHOLD)).toBe(true);
    expect(isIntentionalRoomActivation(ROOM_ACTIVATION_DRAG_THRESHOLD + 1)).toBe(false);
    expect(isIntentionalRoomActivation(Number.NaN)).toBe(false);
  });
});
