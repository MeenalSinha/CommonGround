/** Validation for numbers and text the user types into the negotiation screens. */
import { plan as planConfig } from './config';
import type { UserDetails } from './types';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Empty text means "not set" (null). Otherwise a positive number, optionally a whole number. */
export function parseOptionalNumber(
  raw: string,
  opts: { integer?: boolean; allowZero?: boolean; what: string },
): Parsed<number | null> {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, error: `Enter ${opts.what} as a number.` };
  if (opts.integer && !Number.isInteger(value))
    return { ok: false, error: `Use a whole number for ${opts.what}.` };
  if (value < 0 || (value === 0 && !opts.allowZero)) {
    return {
      ok: false,
      error: `${capitalize(opts.what)} must be ${opts.allowZero ? 'zero or more' : 'greater than zero'}.`,
    };
  }
  if (value > planConfig.maxUserNumber)
    return { ok: false, error: `${capitalize(opts.what)} is too large.` };
  return { ok: true, value };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const NOTE_MAX_LENGTH = 200;

export function cleanDetails(
  patch: Partial<UserDetails>,
  current: UserDetails,
): UserDetails | null {
  const next: UserDetails = { ...current };
  if ('durationMinutes' in patch) {
    const v = patch.durationMinutes;
    if (v != null && (!Number.isInteger(v) || v <= 0 || v > planConfig.maxUserNumber)) return null;
    next.durationMinutes = v ?? null;
  }
  if ('cost' in patch) {
    const v = patch.cost;
    if (v != null && (!Number.isFinite(v) || v < 0 || v > planConfig.maxUserNumber)) return null;
    next.cost = v ?? null;
  }
  if ('note' in patch) {
    const note = (patch.note ?? '').replace(/\s+/g, ' ').trim();
    if (note.length > NOTE_MAX_LENGTH) return null;
    next.note = note;
  }
  return next;
}
