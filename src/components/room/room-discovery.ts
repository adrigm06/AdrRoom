export const ROOM_WELCOME_STORAGE_KEY = 'adrroom-welcome-dismissed-v1';
export const ROOM_ACTIVATION_DRAG_THRESHOLD = 6;

type WelcomeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function hasDismissedRoomWelcome(storage?: WelcomeStorage | null): boolean {
  try {
    return storage?.getItem(ROOM_WELCOME_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function rememberRoomWelcomeDismissal(storage?: WelcomeStorage | null): void {
  try {
    storage?.setItem(ROOM_WELCOME_STORAGE_KEY, 'true');
  } catch {
    // Persistence is optional; discovery must remain usable without it.
  }
}

export function isIntentionalRoomActivation(
  pointerDelta: number,
  threshold = ROOM_ACTIVATION_DRAG_THRESHOLD,
): boolean {
  return Number.isFinite(pointerDelta) && pointerDelta >= 0 && pointerDelta <= threshold;
}
