import { api } from './client';
import type { PaginatedResponse } from '@/types';

export interface SearchHit {
  id: string;
  module: string;
  title: string;
  description?: string;
  status?: string;
  matchedFields: string[];
  score: number;
  url: string;
  createdAt: string;
  highlight?: Record<string, string[]>;
}

export interface GlobalSearchResult {
  took: number; // milliseconds
  total: number;
  results: {
    documents?: SearchHit[];
    deviations?: SearchHit[];
    capa?: SearchHit[];
    complaints?: SearchHit[];
    risks?: SearchHit[];
    changeControl?: SearchHit[];
    equipment?: SearchHit[];
    supplier?: SearchHit[];
    regulatory?: SearchHit[];
    products?: SearchHit[];
  };
}

export interface AllModuleCounts {
  documents: { total: number; pendingReview: number; pendingApproval: number };
  deviations: { total: number; open: number; critical: number };
  capa: { total: number; inProgress: number; overdue: number };
  complaints: { total: number; open: number; critical: number };
  changeControl: { pending: number; pendingApproval: number };
  equipment: { total: number; calibrationDue: number; maintenanceDue: number };
  supplier: { total: number; suspended: number; auditDue: number };
  training: { overdue: number; complianceRate: number };
  risks: { total: number; high: number; veryHigh: number };
  workflowActions: { pending: number; overdue: number };
}

export interface MyActionCounts {
  pendingApprovals: number;
  pendingReviews: number;
  pendingWorkflowActions: number;
  overdueWorkflowActions: number;
  notifications: number;
}

// ─── Supported sort orders ────────────────────────────────────────────────────

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortOrder;
  cursor?: string;
}

// ─── searchApi ────────────────────────────────────────────────────────────────

export const searchApi = {
  // ---------- GLOBAL SEARCH ----------------------------------------------------

  /**
   * Tìm kiếm toàn hệ thống EQMS.
   * @example searchApi.global({ q: 'batch record', modules: ['documents', 'deviations'] })
   * @example searchApi.global({ q: 'paracetamol', highlight: true })
   */
  global: async (params: {
    q: string;
    modules?: string[];
    limit?: number;
    highlight?: boolean;
  }) => {
    const query = new URLSearchParams({ q: params.q });
    if (params.modules?.length) query.set('modules', params.modules.join(','));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.highlight) query.set('highlight', 'true');
    const response = await api.get<GlobalSearchResult>(`/search?${query}`);
    return response.data;
  },

  /**
   * Autocomplete gợi ý khi user gõ (debounce ~300ms ở client trước khi gọi).
   * @example searchApi.suggestions({ q: 'DEV-20' })
   */
  suggestions: async (params: { q: string; modules?: string[]; limit?: number }) => {
    const query = new URLSearchParams({ q: params.q });
    if (params.modules?.length) query.set('modules', params.modules.join(','));
    if (params.limit) query.set('limit', String(params.limit));
    const response = await api.get<{ text: string; module: string; entityId: string; type: string }[]>(
      `/search/suggestions?${query}`
    );
    return response.data;
  },

  /**
   * Tìm kiếm trong 1 module cụ thể với phân trang theo chuẩn.
   * @example searchApi.inModule('deviations', { q: 'temperature', page: 1, sort: 'severity', order: 'desc' })
   */
  inModule: async (
    module: string,
    params: { q: string } & PaginationParams
  ) => {
    const query = new URLSearchParams({ q: params.q });
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    const response = await api.get<PaginatedResponse<SearchHit>>(
      `/search/${module}?${query}`
    );
    return response.data;
  },

  /**
   * Lịch sử tìm kiếm của user hiện tại.
   */
  getRecentSearches: async (limit = 10) => {
    const response = await api.get<{ query: string; searchedAt: string; resultCount?: number }[]>(
      `/search/recent?limit=${limit}`
    );
    return response.data;
  },

  clearRecentSearches: async () => {
    const response = await api.delete('/search/recent');
    return response.data;
  },

  /**
   * Lưu bộ filter để dùng lại.
   * @example searchApi.saveFilter({ name: 'Critical Deviations', module: 'deviations', filters: { severityFilter: 'Critical', statusFilter: 'Open' } })
   */
  saveFilter: async (data: { name: string; module: string; filters: Record<string, any> }) => {
    const response = await api.post('/search/saved', data);
    return response.data;
  },

  getSavedFilters: async () => {
    const response = await api.get<{ id: string; name: string; module: string; filters: Record<string, any> }[]>(
      '/search/saved'
    );
    return response.data;
  },

  deleteSavedFilter: async (id: string) => {
    const response = await api.delete(`/search/saved/${id}`);
    return response.data;
  },
};

// ─── countApi ─────────────────────────────────────────────────────────────────

export const countApi = {
  /**
   * Đếm records trong 1 module theo filter — KHÔNG load data, chỉ trả về số lượng.
   * Nhẹ hơn nhiều so với gọi list API với limit=0.
   *
   * @example countApi.module('deviations', { statusFilter: 'Open' })
   * @example countApi.module('capa', { typeFilter: 'Corrective' })
   */
  module: async (module: string, filters?: Record<string, string | number>) => {
    const query = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== 'All') query.set(k, String(v));
      });
    }
    const response = await api.get<{ count: number }>(`/count/${module}?${query}`);
    return response.data.count;
  },

  /**
   * Lấy số lượng tất cả module cùng 1 lúc — dùng cho dashboard badges và sidebar.
   * Server nên cache kết quả này 60 giây.
   *
   * @example const counts = await countApi.all()
   * // counts.deviations.open → 12
   * // counts.tasks.myOverdue → 3
   */
  all: async () => {
    const response = await api.get<AllModuleCounts>('/count/all');
    return response.data;
  },

  /**
   * Số lượng các hành động đang chờ của user hiện tại.
   * Dùng cho Header notification badge và dashboard.
   * Nên poll mỗi 30 giây để cập nhật real-time.
   *
   * @example const counts = await countApi.myActions()
   * // counts.pendingApprovals → 2 (documents cần approve)
   * // counts.notifications   → 5
   */
  myActions: async () => {
    const response = await api.get<MyActionCounts>('/count/my-actions');
    return response.data;
  },
};
