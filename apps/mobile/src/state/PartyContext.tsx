import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Entity } from '@/types/api';
import {
  initialPartyState,
  makeId,
  partyReducer,
  validateMemberName,
  validatePartyName,
  validateUnresolvedText,
  type DiscoveryRun,
  type PartyAction,
  type PartyState,
  type Validation,
} from './party';

export interface PartyActions {
  createParty: (name: string) => Validation;
  renameParty: (name: string) => Validation;
  resetParty: () => void;
  addMember: (name: string) => Validation<{ id: string }>;
  renameMember: (id: string, name: string) => Validation;
  removeMember: (id: string) => void;
  addInterest: (memberId: string, entity: Entity) => void;
  removeInterest: (memberId: string, entityId: string) => void;
  addUnresolved: (memberId: string, text: string) => Validation;
  removeUnresolved: (memberId: string, id: string) => void;
  setTargetType: (targetType: string | null) => void;
  recordRun: (run: DiscoveryRun) => void;
}

interface PartyContextValue {
  state: PartyState;
  actions: PartyActions;
}

const PartyContext = createContext<PartyContextValue | null>(null);

/**
 * In-memory party state shared by every route. It survives navigation but NOT an app restart
 * (no persistence in Phase 3). The latest state is mirrored in a ref so that two rapid calls
 * (e.g. a double tap) are validated against the state the first call produced.
 */
export function PartyProvider({
  children,
  initialState = initialPartyState,
}: {
  children: ReactNode;
  initialState?: PartyState;
}) {
  const ref = useRef(initialState);
  const [state, setState] = useState(initialState);

  const actions = useMemo<PartyActions>(() => {
    const send = (action: PartyAction) => {
      const next = partyReducer(ref.current, action);
      if (next !== ref.current) {
        ref.current = next;
        setState(next);
      }
    };
    return {
      createParty: (name) => {
        if (ref.current.party) return { ok: false, error: 'You already have a party.' };
        const v = validatePartyName(name);
        if (v.ok) send({ type: 'party/create', id: makeId('party'), name });
        return v;
      },
      renameParty: (name) => {
        const v = validatePartyName(name);
        if (v.ok) send({ type: 'party/rename', name });
        return v;
      },
      resetParty: () => send({ type: 'party/reset' }),
      addMember: (name) => {
        const v = validateMemberName(ref.current.party, name);
        if (!v.ok) return v;
        const id = makeId('member');
        send({ type: 'member/add', id, name });
        return { ok: true, value: { id } };
      },
      renameMember: (id, name) => {
        const v = validateMemberName(ref.current.party, name, id);
        if (v.ok) send({ type: 'member/rename', id, name });
        return v;
      },
      removeMember: (id) => send({ type: 'member/remove', id }),
      addInterest: (memberId, entity) => send({ type: 'interest/add', memberId, entity }),
      removeInterest: (memberId, entityId) => send({ type: 'interest/remove', memberId, entityId }),
      addUnresolved: (memberId, text) => {
        const v = validateUnresolvedText(text);
        if (v.ok) send({ type: 'unresolved/add', memberId, id: makeId('note'), text });
        return v;
      },
      removeUnresolved: (memberId, id) => send({ type: 'unresolved/remove', memberId, id }),
      setTargetType: (targetType) => send({ type: 'discovery/target', targetType }),
      recordRun: (run) => send({ type: 'discovery/run', run }),
    };
  }, []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useParty(): PartyContextValue {
  const value = useContext(PartyContext);
  if (!value) throw new Error('useParty must be used inside PartyProvider');
  return value;
}
