// Drop-in replacement for `window.confirm()` on anything that can't be undone:
//   if (!(await confirmHold({ title: 'Delete this doc?', message: '…', confirmLabel: 'Hold to delete' }))) return;
// It opens the shared hold-to-confirm dialog (rendered once by <ConfirmHost />
// in the root layout) and resolves true only after the button is held, false if
// they cancel. Holding, not retyping or tapping OK, is the whole safeguard.
export interface ConfirmHoldOptions {
  title: string;
  message?: string;
  confirmLabel?: string; // e.g. "Hold to delete"
}

export const CONFIRM_HOLD_EVENT = 'tg:confirm-hold';

export interface ConfirmHoldRequest extends ConfirmHoldOptions {
  resolve: (confirmed: boolean) => void;
}

export function confirmHold(options: ConfirmHoldOptions): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmHoldRequest>(CONFIRM_HOLD_EVENT, { detail: { ...options, resolve } }));
  });
}
