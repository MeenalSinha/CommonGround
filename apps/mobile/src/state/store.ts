/**
 * Root reducer: party actions, negotiation actions, and reconciliation. After ANY party or category
 * change the negotiation session is reconciled, so stale evidence cannot survive its inputs.
 */
import { defaultTitle } from './negotiation/planner';
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

  let candidateSession = next.negotiation;
  if (action.type === 'party/rename' && candidateSession.plan && state.party) {
    const oldDefault = defaultTitle(candidateSession, state.party);
    if (candidateSession.plan.title === oldDefault) {
      candidateSession = {
        ...candidateSession,
        plan: {
          ...candidateSession.plan,
          title: defaultTitle(candidateSession, next.party),
          updatedAt: now(),
        },
      };
    }
  }

  const reconciled = reconcileSession(candidateSession, next.party, next.targetType, now());
  return reconciled === next.negotiation ? next : { ...next, negotiation: reconciled };
}
