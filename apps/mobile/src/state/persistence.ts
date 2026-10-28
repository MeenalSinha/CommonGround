/**
 * Local, on-device persistence for the active party, negotiation session and plan.
 * Not cloud sync, not an account system. Credentials never reach the mobile app, so none are stored.
 *
 * Design:
 * - `SessionStorage` is a three-method async interface; the AsyncStorage adapter is one implementation.
 * - Saved data is a versioned envelope. Restoring validates every field and the references between them.
 * - Anything unreadable is copied to a backup key (never silently destroyed) and the app starts fresh.
 * - Writes are coalesced (latest wins) and executed strictly in order, so an old write cannot overwrite a new one.
 */
import { persistence as cfg } from './negotiation/config';
import type { NegotiationSession } from './negotiation/types';
import { initialPartyState, type Party, type PartyState } from './party';

export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** What is persisted. `run` (raw discovery response) is derived and refetchable, so it is not saved. */
export interface PersistedData {
  party: Party | null;
  targetType: string | null;
  negotiation: NegotiationSession | null;
}

interface Envelope {
  schemaVersion: number;
  savedAt: string;
  data: PersistedData;
}

export const pickPersisted = (s: PartyState): PersistedData => ({
  party: s.party,
  targetType: s.targetType,
  negotiation: s.negotiation,
});

export const isEmptyState = (d: PersistedData) => d.party === null && d.negotiation === null;

export function serialize(data: PersistedData, now: string): string {
  const envelope: Envelope = { schemaVersion: cfg.schemaVersion, savedAt: now, data };
  return JSON.stringify(envelope);
}

export type RestoreResult =
  | { kind: 'empty' }
  | { kind: 'restored'; state: PartyState; savedAt: string }
  | { kind: 'unreadable'; reason: string };

/** Migrations from version N to N+1. Add one here whenever `schemaVersion` is bumped. */
const migrations: Record<number, (data: unknown) => unknown> = {};

export function restore(raw: string | null): RestoreResult {
  if (raw === null) return { kind: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable', reason: 'The saved data was not valid JSON.' };
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.schemaVersion !== 'number' ||
    !Number.isInteger(parsed.schemaVersion)
  ) {
    return { kind: 'unreadable', reason: 'The saved data had no schema version.' };
  }
  let version = parsed.schemaVersion;
  let data: unknown = parsed.data;
  if (version > cfg.schemaVersion) {
    return {
      kind: 'unreadable',
      reason: 'The saved data was written by a newer version of the app.',
    };
  }
  while (version < cfg.schemaVersion) {
    const migrate = migrations[version];
    if (!migrate)
      return { kind: 'unreadable', reason: `No migration exists from schema version ${version}.` };
    try {
      data = migrate(data);
    } catch {
      return { kind: 'unreadable', reason: `Migrating from schema version ${version} failed.` };
    }
    version += 1;
  }
  const problem = validateData(data);
  if (problem) return { kind: 'unreadable', reason: problem };
  const d = data as PersistedData;
  return {
    kind: 'restored',
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    state: {
      ...initialPartyState,
      party: d.party,
      targetType: d.targetType,
      negotiation: d.negotiation,
    },
  };
}

// ---- validation -------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrOrNull = (v: unknown) => v === null || isStr(v);
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function validEntity(v: unknown): boolean {
  return (
    isRecord(v) &&
    isStr(v.id) &&
    v.id !== '' &&
    isStr(v.name) &&
    isStrOrNull(v.type) &&
    isStrOrNull(v.description) &&
    isStrOrNull(v.image_url) &&
    isNumOrNull(v.popularity) &&
    isNumOrNull(v.release_year) &&
    Array.isArray(v.tags) &&
    v.tags.every((t) => isRecord(t) && isStr(t.id) && isStrOrNull(t.name))
  );
}

function validParty(v: unknown): string | null {
  if (!isRecord(v) || !isStr(v.id) || !isStr(v.name) || !Array.isArray(v.members))
    return 'The saved party is malformed.';
  const ids = new Set<string>();
  for (const m of v.members) {
    if (!isRecord(m) || !isStr(m.id) || !isStr(m.displayName) || !isStr(m.avatarColor))
      return 'A saved participant is malformed.';
    if (ids.has(m.id)) return 'The saved party has duplicate participant ids.';
    ids.add(m.id);
    if (!Array.isArray(m.interests) || !m.interests.every(validEntity))
      return 'A saved interest is malformed.';
    const interestIds = (m.interests as { id: string }[]).map((i) => i.id);
    if (new Set(interestIds).size !== interestIds.length)
      return 'A participant has duplicate saved interests.';
    if (
      !Array.isArray(m.unresolvedInterests) ||
      !m.unresolvedInterests.every((u) => isRecord(u) && isStr(u.id) && isStr(u.text))
    ) {
      return 'A saved unresolved interest is malformed.';
    }
  }
  return null;
}

const FEEDBACK = new Set(['interested', 'unsure', 'pass', 'exclude']);
const QUERY_STATUS = new Set(['ok', 'empty', 'failed', 'not_run']);

function validSession(n: unknown, party: Party): string | null {
  const bad = 'The saved negotiation is malformed.';
  if (!isRecord(n)) return bad;
  if (
    !isStr(n.id) ||
    !isStr(n.partyId) ||
    !isStr(n.targetType) ||
    !isStr(n.createdAt) ||
    !isStr(n.updatedAt)
  )
    return bad;
  if (n.partyId !== party.id) return 'The saved negotiation belongs to a different party.';
  if (typeof n.inputsVersion !== 'number' || !Number.isInteger(n.inputsVersion)) return bad;
  if (!isStrOrNull(n.requestFingerprint)) return bad;
  if (typeof n.planLength !== 'number' || !Number.isInteger(n.planLength)) return bad;
  if (!isRecord(n.excludedSignals) || !Object.values(n.excludedSignals).every(isStrArray))
    return bad;
  if (!isStrArray(n.rejectedCandidateIds)) return bad;

  const memberIds = new Set(party.members.map((m) => m.id));
  const c = n.constraints;
  if (
    !isRecord(c) ||
    !isStrArray(c.excludedCandidateIds) ||
    !isNumOrNull(c.budgetMax) ||
    !isNumOrNull(c.maxTotalMinutes)
  )
    return bad;
  if (
    !Array.isArray(c.excludedTags) ||
    !c.excludedTags.every((t) => isRecord(t) && isStr(t.id) && isStrOrNull(t.name))
  )
    return bad;

  if (!isRecord(n.candidates)) return bad;
  for (const [id, cand] of Object.entries(n.candidates)) {
    if (!isRecord(cand) || !validEntity(cand.entity) || (cand.entity as { id: string }).id !== id)
      return 'A saved candidate is malformed.';
    if (typeof cand.manual !== 'boolean' || !isRecord(cand.feedback) || !isRecord(cand.details))
      return 'A saved candidate is malformed.';
    for (const [m, k] of Object.entries(cand.feedback)) {
      if (!memberIds.has(m) || !isStr(k) || !FEEDBACK.has(k))
        return 'Saved feedback is malformed or refers to someone not in the party.';
    }
    const d = cand.details;
    if (!isNumOrNull(d.durationMinutes) || !isNumOrNull(d.cost) || !isStr(d.note))
      return 'Saved candidate details are malformed.';
  }
  if (!isRecord(n.queries)) return bad;
  for (const [id, q] of Object.entries(n.queries)) {
    if (
      !isRecord(q) ||
      q.id !== id ||
      !isStr(q.kind) ||
      !QUERY_STATUS.has(q.status as string) ||
      !isStrArray(q.entityIds) ||
      !isStr(q.signalsKey)
    ) {
      return 'A saved recommendation query is malformed.';
    }
    if (q.memberId !== null && (!isStr(q.memberId) || !memberIds.has(q.memberId)))
      return 'A saved query refers to someone not in the party.';
    if (!Array.isArray(q.results)) return 'A saved query is malformed.';
    for (const r of q.results) {
      if (
        !isRecord(r) ||
        !isStr(r.entityId) ||
        typeof r.position !== 'number' ||
        !(r.entityId in n.candidates)
      ) {
        return 'A saved query result refers to a candidate that is not saved.';
      }
    }
  }
  if (n.plan !== null) {
    const p = n.plan;
    if (
      !isRecord(p) ||
      !isStr(p.id) ||
      !isStr(p.title) ||
      !isStr(p.mode) ||
      !Array.isArray(p.entries)
    )
      return 'The saved plan is malformed.';
    if (p.partyId !== party.id || p.sessionId !== n.id)
      return 'The saved plan belongs to a different party or session.';
    for (const k of ['basedOnVersion', 'revision', 'requestedLength'] as const) {
      if (typeof p[k] !== 'number') return 'The saved plan is malformed.';
    }
    if (
      !(p.readyRevision === null || typeof p.readyRevision === 'number') ||
      !isStrOrNull(p.finalizedAt)
    )
      return 'The saved plan is malformed.';
    if (!isRecord(p.constraints) || !isStrArray(p.provenanceQueryIds))
      return 'The saved plan is malformed.';
    const seen = new Set<string>();
    for (const e of p.entries) {
      if (
        !isRecord(e) ||
        !isStr(e.candidateId) ||
        !isStrArray(e.reasons) ||
        (e.origin !== 'planner' && e.origin !== 'user')
      )
        return 'A saved plan entry is malformed.';
      if (seen.has(e.candidateId)) return 'The saved plan lists an entry twice.';
      seen.add(e.candidateId);
    }
  }
  return null;
}

/** Returns a description of the first problem, or null when the data is sound. */
export function validateData(data: unknown): string | null {
  if (!isRecord(data)) return 'The saved data is malformed.';
  if (!isStrOrNull(data.targetType)) return 'The saved category is malformed.';
  if (data.party === null)
    return data.negotiation === null ? null : 'A negotiation was saved without a party.';
  const problem = validParty(data.party);
  if (problem) return problem;
  if (data.negotiation === null) return null;
  return validSession(data.negotiation, data.party as Party);
}

// ---- storage adapters and the write queue -----------------------------------------------------------

/** In-memory storage for tests and as a safe fallback. */
export function memoryStorage(
  initial: Record<string, string> = {},
): SessionStorage & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

export type LoadResult = RestoreResult | { kind: 'storage_error'; message: string };

/** Reads and validates; quarantines unreadable data under the backup key instead of deleting it. */
export async function loadSession(storage: SessionStorage): Promise<LoadResult> {
  let raw: string | null;
  try {
    raw = await storage.getItem(cfg.storageKey);
  } catch {
    return { kind: 'storage_error', message: 'Saved data could not be read from this device.' };
  }
  const result = restore(raw);
  if (result.kind === 'unreadable' && raw !== null) {
    try {
      await storage.setItem(cfg.backupKey, raw);
      await storage.removeItem(cfg.storageKey);
    } catch {
      /* the quarantine is best effort; the app still starts fresh */
    }
  }
  return result;
}

export interface Persistor {
  schedule(data: PersistedData): void;
  /** Writes any pending data now and resolves when every queued write has finished. */
  flush(): Promise<void>;
  /** Cancels pending writes and removes the saved session (used for "start over"). */
  clear(): Promise<void>;
}

export function createPersistor(
  storage: SessionStorage,
  opts: {
    debounceMs?: number;
    now?: () => string;
    onError?: (message: string) => void;
    onSaved?: () => void;
  } = {},
): Persistor {
  const debounceMs = opts.debounceMs ?? cfg.debounceMs;
  const now = opts.now ?? (() => new Date().toISOString());
  let pending: PersistedData | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const enqueue = (job: () => Promise<void>, errorMessage: string) => {
    chain = chain.then(job).then(
      () => opts.onSaved?.(),
      () => opts.onError?.(errorMessage),
    );
    return chain;
  };
  const stopTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const writePending = () => {
    stopTimer();
    if (!pending) return chain;
    const data = pending;
    pending = null;
    return enqueue(
      () =>
        isEmptyState(data)
          ? storage.removeItem(cfg.storageKey)
          : storage.setItem(cfg.storageKey, serialize(data, now())),
      'Your latest changes could not be saved on this device.',
    );
  };
  return {
    schedule(data) {
      pending = data;
      stopTimer();
      timer = setTimeout(() => void writePending(), debounceMs);
    },
    flush: () => writePending(),
    clear() {
      stopTimer();
      pending = null;
      return enqueue(
        () => storage.removeItem(cfg.storageKey),
        'The saved session could not be cleared.',
      );
    },
  };
}
