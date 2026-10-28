/** Types mirroring the backend's public contract (docs/API_CONTRACT.md, section 2). */

export type IntegrationState =
  | 'not_configured'
  | 'pending_verification'
  | 'ready'
  | 'auth_failed'
  | 'rate_limited'
  | 'unavailable';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  time: string;
}

export interface QlooStatus {
  state: IntegrationState;
  configured: boolean;
  ready: boolean;
  message: string;
  base_host: string | null;
  last_checked_at: string | null;
  last_verified_at: string | null;
  last_error_code: string | null;
}

export interface Tag {
  id: string;
  name: string | null;
  type: string | null;
}

export interface Entity {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  image_url: string | null;
  popularity: number | null;
  release_year: number | null;
  tags: Tag[];
}

export interface Provenance {
  source: string;
  endpoint: string;
  retrieved_at: string;
  upstream_duration_ms: number | null;
  parameters: Record<string, string | number | string[]>;
}

export interface EntitySearchResponse {
  items: Entity[];
  count: number;
  page: number;
  limit: number;
  empty: boolean;
  provenance: Provenance;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id: string | null;
    details: Record<string, unknown>;
  };
}

export interface EntityTypesResponse {
  types: string[];
}

export interface RecommendationsResponse {
  items: Entity[];
  count: number;
  filter_type: string;
  signal_entity_ids: string[];
  signal_tag_ids: string[];
  limit: number;
  offset: number;
  empty: boolean;
  provenance: Provenance;
}
