import { request } from './apiClient';
import type {
  EntitySearchResponse,
  EntityTypesResponse,
  HealthResponse,
  QlooStatus,
  RecommendationsResponse,
} from '@/types/api';

export const integrationApi = {
  health: () => request<HealthResponse>('/health'),
  qlooStatus: () => request<QlooStatus>('/api/v1/integrations/qloo/status'),
  verifyQloo: () => request<QlooStatus>('/api/v1/integrations/qloo/verify', { method: 'POST' }),
  entityTypes: () => request<EntityTypesResponse>('/api/v1/qloo/entity-types'),
  searchEntities: (query: string, options: { types?: string[]; limit?: number } = {}) =>
    request<EntitySearchResponse>('/api/v1/qloo/entities/search', {
      query: {
        query,
        limit: options.limit ?? 8,
        types: options.types && options.types.length > 0 ? options.types.join(',') : undefined,
      },
    }),
  /** Entity ids are real Qloo ids; the backend validates them and enforces the 20-id limit. */
  recommendations: (type: string, entityIds: string[], limit = 10) =>
    request<RecommendationsResponse>('/api/v1/qloo/insights/recommendations', {
      query: { type, entity_ids: entityIds.join(','), limit },
    }),
};
