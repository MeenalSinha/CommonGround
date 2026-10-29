import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { integrationApi } from '@/services/integrationApi';
import type { Entity } from '@/types/api';
import { gatherCandidates, type GatherStage, type GatherSummary } from './negotiation/orchestrator';
import type { NegotiationAction } from './negotiation/reducer';
import type {
  FeedbackKind,
  GroupConstraints,
  PlanOutcome,
  TagRef,
  UserDetails,
} from './negotiation/types';
import {
  createPersistor,
  loadSession,
  pickPersisted,
  type Persistor,
  type SessionStorage,
} from './persistence';
import {
  initialPartyState,
  makeId,
  validateMemberName,
  validatePartyName,
  validateUnresolvedText,
  type DiscoveryRun,
  type PartyAction,
  type PartyState,
  type Validation,
} from './party';
import { rootReducer, type AppAction } from './store';

export interface NegotiationActions {
  start: () => void;
  reset: () => void;
  setSignal: (scope: string, entityId: string, included: boolean) => void;
  /** Requests only what is missing or failed unless `force` is set. Runs one at a time. */
  gather: (opts?: { force?: boolean }) => Promise<GatherSummary | null>;
  setFeedback: (candidateId: string, memberId: string, kind: FeedbackKind | null) => void;
  setConstraint: (patch: Partial<Pick<GroupConstraints, 'budgetMax' | 'maxTotalMinutes'>>) => void;
  excludeTag: (tag: TagRef) => void;
  includeTag: (tagId: string) => void;
  excludeCandidate: (candidateId: string) => void;
  unexcludeCandidate: (candidateId: string) => void;
  reject: (candidateId: string) => void;
  unreject: (candidateId: string) => void;
  setDetails: (candidateId: string, patch: Partial<UserDetails>) => void;
  addManual: (entity: Entity) => void;
  setPlanLength: (length: number) => void;
  generatePlan: (opts?: { alternative?: boolean }) => PlanOutcome | null;
  addToPlan: (candidateId: string) => PlanOutcome | null;
  removeFromPlan: (candidateId: string) => void;
  replaceInPlan: (candidateId: string) => PlanOutcome | null;
  moveInPlan: (candidateId: string, delta: -1 | 1) => void;
  rejectFromPlan: (candidateId: string) => void;
  excludeFromPlan: (candidateId: string) => void;
  renamePlan: (title: string) => void;
  markReady: () => PlanOutcome | null;
  acknowledgeInputs: () => PlanOutcome | null;
  finalize: (confirmed: boolean) => PlanOutcome | null;
  reopen: () => void;
}

export interface PartyActions {
  createParty: (name: string) => Validation;
  renameParty: (name: string) => Validation;
  resetParty: () => void;
  /** Clears the party, negotiation, plan AND the copy saved on this device. */
  startOver: () => Promise<void>;
  addMember: (name: string) => Validation<{ id: string }>;
  renameMember: (id: string, name: string) => Validation;
  removeMember: (id: string) => void;
  addInterest: (memberId: string, entity: Entity) => void;
  removeInterest: (memberId: string, entityId: string) => void;
  addUnresolved: (memberId: string, text: string) => Validation;
  removeUnresolved: (memberId: string, id: string) => void;
  setTargetType: (targetType: string | null) => void;
  recordRun: (run: DiscoveryRun) => void;
  negotiation: NegotiationActions;
}

export interface GatherState {
  running: boolean;
  stage: GatherStage | null;
  summary: GatherSummary | null;
}

export interface PersistenceInfo {
  /** 'restoring' until the saved session has been read; 'ready' afterwards. Never ready early. */
  status: 'restoring' | 'ready';
  /** A calm explanation when saved data could not be restored. */
  notice: string | null;
  /** The last storage problem, if any. */
  error: string | null;
  /** False when no storage is configured (nothing is saved). */
  enabled: boolean;
}

interface PartyContextValue {
  state: PartyState;
  actions: PartyActions;
  gather: GatherState;
  persistence: PersistenceInfo;
}

const PartyContext = createContext<PartyContextValue | null>(null);
const nowIso = () => new Date().toISOString();

/**
 * Party + negotiation state shared by every route, mirrored in a ref so two rapid calls validate against
 * the state the first one produced. When `storage` is given, the saved session is restored BEFORE `status`
 * becomes 'ready', and every change is saved (debounced, in order) on this device only.
 */
export function PartyProvider({
  children,
  initialState = initialPartyState,
  storage = null,
  persistDebounceMs,
}: {
  children: ReactNode;
  initialState?: PartyState;
  storage?: SessionStorage | null;
  persistDebounceMs?: number;
}) {
  const ref = useRef(initialState);
  const [state, setState] = useState(initialState);
  const [gather, setGather] = useState<GatherState>({ running: false, stage: null, summary: null });
  const [persistence, setPersistence] = useState<PersistenceInfo>({
    status: storage ? 'restoring' : 'ready',
    notice: null,
    error: null,
    enabled: storage !== null,
  });
  const gatherRunning = useRef(false);
  const mounted = useRef(true);
  const persistor = useRef<Persistor | null>(null);
  const saveError = useRef(false);
  const ready = persistence.status === 'ready';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Restore once. Nothing is rendered as restored until this finishes.
  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    persistor.current = createPersistor(storage, {
      debounceMs: persistDebounceMs,
      onError: (message) => {
        saveError.current = true;
        if (mounted.current) setPersistence((p) => ({ ...p, error: message }));
      },
      // Only touch state when a previous error needs clearing; a routine successful save changes nothing.
      onSaved: () => {
        if (!saveError.current) return;
        saveError.current = false;
        if (mounted.current) setPersistence((p) => ({ ...p, error: null }));
      },
    });
    void loadSession(storage).then((result) => {
      if (cancelled) return;
      if (result.kind === 'restored') {
        ref.current = result.state;
        setState(result.state);
        setPersistence((p) => ({ ...p, status: 'ready' }));
      } else if (result.kind === 'unreadable') {
        setPersistence((p) => ({
          ...p,
          status: 'ready',
          notice: `We couldn’t restore your saved party (${result.reason.replace(/\.$/, '')}), so you’re starting fresh. A copy of the unreadable data was kept on this device.`,
        }));
      } else if (result.kind === 'storage_error') {
        setPersistence((p) => ({ ...p, status: 'ready', error: result.message }));
      } else {
        setPersistence((p) => ({ ...p, status: 'ready' }));
      }
    });
    return () => {
      cancelled = true;
      void persistor.current?.flush();
    };
  }, [storage, persistDebounceMs]);

  // Save after every change once restored (never before, so an empty state cannot overwrite a good save).
  useEffect(() => {
    if (ready && storage) persistor.current?.schedule(pickPersisted(state));
  }, [state, ready, storage]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void persistor.current?.flush();
    });
    return () => sub.remove();
  }, []);

  const send = useCallback((action: AppAction) => {
    const next = rootReducer(ref.current, action);
    if (next !== ref.current) {
      ref.current = next;
      setState(next);
    }
  }, []);

  const negotiation = useMemo<NegotiationActions>(() => {
    const n = (build: (now: string) => NegotiationAction) => send(build(nowIso()));
    const outcome = (action: NegotiationAction) => {
      send(action);
      return ref.current.negotiation?.lastOutcome ?? null;
    };
    return {
      start: () => n((now) => ({ type: 'negotiation/start', id: makeId('session'), now })),
      reset: () => send({ type: 'negotiation/reset' }),
      setSignal: (scope, entityId, included) =>
        n((now) => ({ type: 'negotiation/signal', scope, entityId, included, now })),
      gather: async (opts) => {
        if (gatherRunning.current) return null; // single flight: no overlapping request bursts
        gatherRunning.current = true;
        setGather({ running: true, stage: null, summary: null });
        try {
          const summary = await gatherCandidates({
            getState: () => ref.current,
            dispatch: send,
            recommend: integrationApi.recommendations,
            force: opts?.force,
            onStage: (stage) => mounted.current && setGather((g) => ({ ...g, stage })),
          });
          if (mounted.current) setGather({ running: false, stage: null, summary });
          return summary;
        } catch {
          if (mounted.current) setGather({ running: false, stage: null, summary: null });
          return null;
        } finally {
          gatherRunning.current = false;
        }
      },
      setFeedback: (candidateId, memberId, kind) =>
        n((now) => ({ type: 'negotiation/feedback', candidateId, memberId, kind, now })),
      setConstraint: (patch) => n((now) => ({ type: 'negotiation/constraint', patch, now })),
      excludeTag: (tag) => n((now) => ({ type: 'negotiation/excludeTag', tag, now })),
      includeTag: (tagId) => n((now) => ({ type: 'negotiation/includeTag', tagId, now })),
      excludeCandidate: (candidateId) =>
        n((now) => ({ type: 'negotiation/excludeCandidate', candidateId, now })),
      unexcludeCandidate: (candidateId) =>
        n((now) => ({ type: 'negotiation/unexcludeCandidate', candidateId, now })),
      reject: (candidateId) => n((now) => ({ type: 'negotiation/reject', candidateId, now })),
      unreject: (candidateId) => n((now) => ({ type: 'negotiation/unreject', candidateId, now })),
      setDetails: (candidateId, patch) =>
        n((now) => ({ type: 'negotiation/details', candidateId, patch, now })),
      addManual: (entity) => n((now) => ({ type: 'negotiation/addManual', entity, now })),
      setPlanLength: (length) => n((now) => ({ type: 'negotiation/planLength', length, now })),
      generatePlan: (opts) =>
        outcome({
          type: 'plan/generate',
          planId: makeId('plan'),
          alternative: opts?.alternative ?? false,
          now: nowIso(),
        }),
      addToPlan: (candidateId) =>
        outcome({ type: 'plan/add', candidateId, planId: makeId('plan'), now: nowIso() }),
      removeFromPlan: (candidateId) => n((now) => ({ type: 'plan/remove', candidateId, now })),
      replaceInPlan: (candidateId) => outcome({ type: 'plan/replace', candidateId, now: nowIso() }),
      moveInPlan: (candidateId, delta) =>
        n((now) => ({ type: 'plan/move', candidateId, delta, now })),
      rejectFromPlan: (candidateId) => n((now) => ({ type: 'plan/reject', candidateId, now })),
      excludeFromPlan: (candidateId) => n((now) => ({ type: 'plan/exclude', candidateId, now })),
      renamePlan: (title) => n((now) => ({ type: 'plan/rename', title, now })),
      markReady: () => outcome({ type: 'plan/ready', now: nowIso() }),
      acknowledgeInputs: () => outcome({ type: 'plan/acknowledge', now: nowIso() }),
      finalize: (confirmed) => outcome({ type: 'plan/finalize', confirmed, now: nowIso() }),
      reopen: () => n((now) => ({ type: 'plan/reopen', now })),
    };
  }, [send]);

  const actions = useMemo<PartyActions>(() => {
    const sendParty = (action: PartyAction) => send(action);
    return {
      createParty: (name) => {
        if (ref.current.party) return { ok: false, error: 'You already have a party.' };
        const v = validatePartyName(name);
        if (v.ok) sendParty({ type: 'party/create', id: makeId('party'), name });
        return v;
      },
      renameParty: (name) => {
        const v = validatePartyName(name);
        if (v.ok) sendParty({ type: 'party/rename', name });
        return v;
      },
      resetParty: () => sendParty({ type: 'party/reset' }),
      startOver: async () => {
        sendParty({ type: 'party/reset' });
        await persistor.current?.clear();
      },
      addMember: (name) => {
        const v = validateMemberName(ref.current.party, name);
        if (!v.ok) return v;
        const id = makeId('member');
        sendParty({ type: 'member/add', id, name });
        return { ok: true, value: { id } };
      },
      renameMember: (id, name) => {
        const v = validateMemberName(ref.current.party, name, id);
        if (v.ok) sendParty({ type: 'member/rename', id, name });
        return v;
      },
      removeMember: (id) => sendParty({ type: 'member/remove', id }),
      addInterest: (memberId, entity) => sendParty({ type: 'interest/add', memberId, entity }),
      removeInterest: (memberId, entityId) =>
        sendParty({ type: 'interest/remove', memberId, entityId }),
      addUnresolved: (memberId, text) => {
        const v = validateUnresolvedText(text);
        if (v.ok) sendParty({ type: 'unresolved/add', memberId, id: makeId('note'), text });
        return v;
      },
      removeUnresolved: (memberId, id) => sendParty({ type: 'unresolved/remove', memberId, id }),
      setTargetType: (targetType) => sendParty({ type: 'discovery/target', targetType }),
      recordRun: (run) => sendParty({ type: 'discovery/run', run }),
      negotiation,
    };
  }, [send, negotiation]);

  const value = useMemo(
    () => ({ state, actions, gather, persistence }),
    [state, actions, gather, persistence],
  );
  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useParty(): PartyContextValue {
  const value = useContext(PartyContext);
  if (!value) throw new Error('useParty must be used inside PartyProvider');
  return value;
}
