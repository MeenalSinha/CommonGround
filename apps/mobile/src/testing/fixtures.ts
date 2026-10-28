/** Test-only fixtures. Never imported by production code. */
import { initialPartyState, partyReducer, type PartyAction, type PartyState } from '@/state/party';
import type { Entity, RecommendationsResponse } from '@/types/api';

export function entity(id: string, name: string, type = 'urn:entity:artist'): Entity {
  return {
    id,
    name,
    type,
    description: null,
    image_url: null,
    popularity: null,
    release_year: null,
    tags: [],
  };
}

export interface SeedMember {
  name: string;
  interests?: Entity[];
}

/** Builds a party state by replaying real reducer actions. */
export function seedParty(members: SeedMember[], name = 'Test party'): PartyState {
  const actions: PartyAction[] = [{ type: 'party/create', id: 'p1', name }];
  members.forEach((m, i) => {
    actions.push({ type: 'member/add', id: `m${i + 1}`, name: m.name });
    for (const e of m.interests ?? []) {
      actions.push({ type: 'interest/add', memberId: `m${i + 1}`, entity: e });
    }
  });
  return actions.reduce(partyReducer, initialPartyState);
}

export const ENTITY_TYPES = ['urn:entity:artist', 'urn:entity:movie'];

export function recommendationsPayload(
  items: Entity[],
  overrides: Partial<RecommendationsResponse> = {},
): RecommendationsResponse {
  return {
    items,
    count: items.length,
    filter_type: 'urn:entity:movie',
    signal_entity_ids: [],
    signal_tag_ids: [],
    limit: 10,
    offset: 0,
    empty: items.length === 0,
    provenance: {
      source: 'qloo',
      endpoint: '/v2/insights',
      retrieved_at: '2026-01-01T00:00:00Z',
      upstream_duration_ms: null,
      parameters: {},
    },
    ...overrides,
  };
}
