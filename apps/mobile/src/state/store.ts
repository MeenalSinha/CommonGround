/**
 * Root reducer: party actions, negotiation actions, and reconciliation. After ANY party or category
 * change the negotiation session is reconciled, so stale evidence cannot survive its inputs.
 */
import { reconcileSession } from './negotiation/pool';
import { negotiationReducer, type NegotiationAction } from './negotiation/reducer';
import { partyReducer, type PartyAction, type PartyState } from './party';

export type AppAction = PartyAction | NegotiationAction;

const isNegotiation = (a: AppAction): a is NegotiationAction =>
  a.type.startsWith('negotiation/') || a.type.startsWith('plan/');

export function rootReducer(
  state: PartyState,
  action: AppAction,
  now: () => string = () => new Date().toISOString(),
): PartyState {
  if (isNegotiation(action)) return negotiationReducer(state, action);
  const next = partyReducer(state, action);
  if (next === state || !next.negotiation) return next;
  const reconciled = reconcileSession(next.negotiation, next.party, next.targetType, now());
  return reconciled === next.negotiation ? next : { ...next, negotiation: reconciled };
}
