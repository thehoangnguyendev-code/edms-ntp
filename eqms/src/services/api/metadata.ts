

import { api } from './client';

export interface SelectOption {
  label: string;
  value: string;
  color?: string;
  description?: string;
}

export interface ModuleMetadata {
  categories?: SelectOption[];
  severities?: SelectOption[];
  statuses?: SelectOption[];
  types?: SelectOption[];
  [key: string]: SelectOption[] | undefined;
}

export const metadataApi = {
  /**
   * Lấy tất cả các danh sách options cho dropdown bộ lọc của 1 module cụ thể.
   * Đây là API chính để đổ dữ liệu vào các Select/Multiselect filters.
   * 
   * @example metadataApi.getFilters('deviations') → calls GET /api/deviations/filters
   * @example metadataApi.getFilters('capa') → calls GET /api/capa/filters
   */
  getFilters: async (module: string) => {
    const response = await api.get<any>(`/${module}/filters`);
    return response.data;
  },

  /**
   * (Cách tiếp cận 2) Lấy metadata tập trung qua mapping.
   * @example metadataApi.getModuleOptions('deviations', 'category,severity')
   */
  getModuleOptions: async (module: string, fields?: string) => {
    const query = fields ? `?fields=${fields}` : '';
    const response = await api.get<ModuleMetadata>(`/metadata/options/${module}${query}`);
    return response.data;
  },

  /**
   * Danh sách phòng ban dùng cho các bộ lọc hoặc form.
   */
  getDepartments: async () => {
    const response = await api.get<{ id: string; name: string; code: string }[]>(
      '/metadata/departments'
    );
    return response.data;
  },

  /**
   * Danh sách người dùng rút gọn để phục vụ bộ lọc "Assigned To".
   */
  getUsersLookup: async (params?: { department?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) query.set(k, v);
      });
    }
    const response = await api.get<{
      id: string;
      username?: string;
      fullName: string;
      accessProfiles: { id: string; code: string; name: string }[];
      department?: string;
      businessUnit?: string;
      position?: string;
      employeeCode?: string;
      email?: string;
    }[]>(`/metadata/users?${query}`);
    return response.data;
  },

  /**
   * Danh sách sản phẩm dùng cho các bộ lọc liên quan đến chất lượng sản phẩm.
   */
  getProductsLookup: async (search?: string) => {
    const query = search ? `?search=${search}` : '';
    const response = await api.get<{ id: string; name: string; code: string }[]>(
      `/metadata/products${query}`
    );
    return response.data;
  },

  /**
   * Danh sách các nhà cung cấp.
   */
  getSuppliersLookup: async () => {
    const response = await api.get<{ id: string; name: string; category: string }[]>(
      '/metadata/suppliers'
    );
    return response.data;
  },

  /**
   * Lấy cấu hình các trường dữ liệu tùy chỉnh cho 1 module.
   */
  getCustomFields: async (module: string) => {
    const response = await api.get<any[]>(`/metadata/custom-fields/${module}`);
    return response.data;
  }
};
